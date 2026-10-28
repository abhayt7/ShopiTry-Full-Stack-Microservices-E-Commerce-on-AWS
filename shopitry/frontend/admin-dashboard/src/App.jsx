import React, { useEffect, useState, useCallback } from 'react';
import { api } from './api.js';

const NEXT = { PENDING: ['PAID', 'CANCELLED'], PAID: ['PROCESSING', 'CANCELLED'], PROCESSING: ['SHIPPED'], SHIPPED: ['DELIVERED'], DELIVERED: [], CANCELLED: [] };

export default function App() {
  const [auth, setAuth] = useState(() => JSON.parse(localStorage.getItem('shopitry_admin') || 'null'));
  const token = auth?.token;
  const [tab, setTab] = useState('dashboard');
  const [login, setLogin] = useState({ email: 'admin@shopitry.com', password: 'adminpassword123' });
  const [stats, setStats] = useState(null); const [health, setHealth] = useState(null);
  const [products, setProducts] = useState([]); const [orders, setOrders] = useState([]);
  const [form, setForm] = useState({ name: '', category: '', price: '', stock: '' });
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setStats(await api('/orders/stats', { token }));
      setOrders(await api('/orders?all=true', { token }));
      setProducts(await api('/catalog/products'));
      setHealth(await api('/health'));
    } catch (e) { setErr(e.message); }
  }, [token]);
  useEffect(() => { load(); const id = setInterval(load, 15000); return () => clearInterval(id); }, [load]);

  const doLogin = async () => {
    try { const d = await api('/auth/login', { method: 'POST', body: login });
      if (d.user.role !== 'admin') return setErr('Admin account required');
      localStorage.setItem('shopitry_admin', JSON.stringify(d)); setAuth(d); setErr(''); }
    catch (e) { setErr(e.message); }
  };
  const addProduct = async () => { try { await api('/catalog/products', { method: 'POST', token, body: { ...form, price: +form.price, stock: +form.stock } }); setForm({ name: '', category: '', price: '', stock: '' }); load(); } catch (e) { setErr(e.message); } };
  const del = async (id) => { await api(`/catalog/products/${id}`, { method: 'DELETE', token }); load(); };
  const setStock = async (p) => { const s = prompt('New stock for ' + p.name, p.stock); if (s !== null) { await api(`/catalog/products/${p._id}`, { method: 'PUT', token, body: { stock: +s } }); load(); } };
  const move = async (id, status) => { try { await api(`/orders/${id}/status`, { method: 'PATCH', token, body: { status } }); load(); } catch (e) { setErr(e.message); } };

  if (!auth) return <main><div className="card row"><h3>ShopiTry Admin</h3>
    <input value={login.email} onChange={(e) => setLogin({ ...login, email: e.target.value })} />
    <input type="password" value={login.password} onChange={(e) => setLogin({ ...login, password: e.target.value })} />
    <button onClick={doLogin}>Login</button>{err && <span className="err">{err}</span>}</div></main>;

  return (<>
    <header><h1>⚙️ ShopiTry Admin</h1>
      {['dashboard', 'products', 'orders'].map((t) => <button key={t} className={tab === t ? '' : 'ghost'} onClick={() => setTab(t)}>{t}</button>)}
      <button className="ghost" onClick={() => { localStorage.removeItem('shopitry_admin'); setAuth(null); }}>Logout</button></header>
    <main>
      {err && <div className="err">{err} <button className="ghost" onClick={() => setErr('')}>dismiss</button></div>}
      {tab === 'dashboard' && stats && <>
        <div className="kpis"><div className="card kpi"><span className="mut">Revenue</span><b>${stats.revenue}</b></div>
          <div className="card kpi"><span className="mut">Total orders</span><b>{stats.totalOrders}</b></div>
          {Object.entries(stats.byStatus).map(([k, v]) => <div className="card kpi" key={k}><span className="mut">{k}</span><b>{v}</b></div>)}</div>
        <div className="card"><h3>Cluster health</h3><div className="row">{health?.services.map((s) => <span key={s.name} className={`pill ${s.status}`}>{s.name} {s.status}</span>)}</div></div></>}
      {tab === 'products' && <div className="card"><h3>Products</h3>
        <div className="row" style={{ marginBottom: 12 }}>{['name', 'category', 'price', 'stock'].map((k) => <input key={k} placeholder={k} value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />)}<button onClick={addProduct}>Add</button></div>
        <table><thead><tr><th>Name</th><th>Category</th><th>Price</th><th>Stock</th><th /></tr></thead><tbody>
          {products.map((p) => <tr key={p._id}><td>{p.name}</td><td>{p.category}</td><td>${p.price}</td><td>{p.stock}</td>
            <td className="row"><button className="ghost" onClick={() => setStock(p)}>Edit stock</button><button className="danger" onClick={() => del(p._id)}>Delete</button></td></tr>)}</tbody></table></div>}
      {tab === 'orders' && <div className="card"><h3>Orders</h3><table><thead><tr><th>Order</th><th>Customer</th><th>Total</th><th>Status</th><th>Move to</th></tr></thead><tbody>
        {orders.map((o) => <tr key={o._id}><td>{o._id.slice(-6)}</td><td>{o.userEmail}</td><td>${o.total}</td><td className={o.status}>{o.status}</td>
          <td className="row">{NEXT[o.status].map((s) => <button key={s} className={s === 'CANCELLED' ? 'danger' : ''} onClick={() => move(o._id, s)}>{s}</button>)}</td></tr>)}</tbody></table></div>}
    </main></>);
}
