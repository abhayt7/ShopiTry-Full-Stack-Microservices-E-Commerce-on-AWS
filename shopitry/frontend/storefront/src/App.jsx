import React, { useEffect, useState, useCallback } from 'react';
import { api } from './api.js';

export default function App() {
  const [auth, setAuth] = useState(() => JSON.parse(localStorage.getItem('shopitry_auth') || 'null'));
  const token = auth?.token;
  const [view, setView] = useState('shop');
  const [products, setProducts] = useState([]);
  const [cats, setCats] = useState(['All']);
  const [q, setQ] = useState(''); const [cat, setCat] = useState('All');
  const [cart, setCart] = useState({ items: [], subtotal: 0, tax: 0, shipping: 0, total: 0 });
  const [open, setOpen] = useState(false);
  const [orders, setOrders] = useState([]);
  const [health, setHealth] = useState(null);
  const [msg, setMsg] = useState('');
  const [login, setLogin] = useState({ email: 'elena@example.com', password: 'customerpassword123' });
  const [card, setCard] = useState('4242424242424242');
  const [quick, setQuick] = useState(null);

  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(''), 4000); };
  const loadProducts = useCallback(() => api(`/catalog/products?q=${encodeURIComponent(q)}&category=${encodeURIComponent(cat)}`).then(setProducts).catch((e) => flash(e.message)), [q, cat]);
  const loadCart = useCallback(() => token && api('/cart', { token }).then(setCart).catch(() => {}), [token]);
  const loadOrders = useCallback(() => token && api('/orders', { token }).then(setOrders).catch(() => {}), [token]);

  useEffect(() => { loadProducts(); }, [loadProducts]);
  useEffect(() => { api('/catalog/categories').then(setCats).catch(() => {}); }, []);
  useEffect(() => { loadCart(); loadOrders(); }, [loadCart, loadOrders]);
  useEffect(() => { const t = () => api('/health').then(setHealth).catch(() => setHealth(null)); t(); const id = setInterval(t, 10000); return () => clearInterval(id); }, []);

  const doLogin = async () => { try { const d = await api('/auth/login', { method: 'POST', body: login }); localStorage.setItem('shopitry_auth', JSON.stringify(d)); setAuth(d); } catch (e) { flash(e.message); } };
  const logout = () => { localStorage.removeItem('shopitry_auth'); setAuth(null); setCart({ items: [], total: 0 }); setOrders([]); };
  const add = async (id) => { if (!token) return flash('Please log in first'); try { setCart(await api('/cart/items', { method: 'POST', token, body: { productId: id, qty: 1 } })); setOpen(true); } catch (e) { flash(e.message); } };
  const remove = async (id) => setCart(await api(`/cart/items/${id}`, { method: 'DELETE', token }));
  const checkout = async () => {
    try { const o = await api('/orders/checkout', { method: 'POST', token, body: { address: { city: 'Pune' }, payment: { cardNumber: card } } });
      flash(`Order placed! Status: ${o.status}`); setOpen(false); loadCart(); loadOrders(); setView('orders'); }
    catch (e) { flash(e.message); }
  };

  return (<>
    <header>
      <h1>🛍️ ShopiTry</h1>
      <button className="ghost" onClick={() => setView('shop')}>Shop</button>
      {auth && <button className="ghost" onClick={() => { setView('orders'); loadOrders(); }}>My orders</button>}
      {auth && <button onClick={() => setOpen(true)}>Cart ({cart.items.length})</button>}
      {auth ? <button className="ghost" onClick={logout}>Logout ({auth.user.name})</button> : null}
    </header>
    <main>
      {msg && <div className="card" style={{ marginBottom: 12 }}>{msg}</div>}
      {!auth && <div className="card row" style={{ marginBottom: 16 }}>
        <input value={login.email} onChange={(e) => setLogin({ ...login, email: e.target.value })} placeholder="email" />
        <input type="password" value={login.password} onChange={(e) => setLogin({ ...login, password: e.target.value })} placeholder="password" />
        <button onClick={doLogin}>Login</button><span className="mut">Demo account is pre-filled</span></div>}

      {view === 'shop' && <>
        <div className="row" style={{ marginBottom: 16 }}>
          <input placeholder="Search products..." value={q} onChange={(e) => setQ(e.target.value)} />
          <select value={cat} onChange={(e) => setCat(e.target.value)}>{cats.map((c) => <option key={c}>{c}</option>)}</select>
        </div>
        <div className="grid">{products.map((p) => (
          <div className="card" key={p._id}>
            <span className="pill">{p.category}</span><h3>{p.name}</h3>
            <div className="row spread"><span className="price">${p.price.toFixed(2)}</span><span className="mut">{p.stock} in stock</span></div>
            <div className="row" style={{ marginTop: 10 }}>
              <button onClick={() => add(p._id)} disabled={p.stock < 1}>Add to cart</button>
              <button className="ghost" onClick={() => setQuick(p)}>Specs</button></div>
          </div>))}</div>
        {products.length === 0 && <p className="mut">No products (is the catalog service running?)</p>}
      </>}

      {view === 'orders' && <div className="card"><h3>Order history</h3>
        <table><thead><tr><th>Order</th><th>Date</th><th>Total</th><th>Status</th></tr></thead><tbody>
          {orders.map((o) => <tr key={o._id}><td>{o._id.slice(-6)}</td><td>{new Date(o.createdAt).toLocaleString()}</td><td>${o.total.toFixed(2)}</td><td className={o.status}>{o.status}</td></tr>)}
        </tbody></table></div>}

      <div className="card" style={{ marginTop: 24 }}><h3>Cluster telemetry</h3>
        {!health ? <span className="DOWN">Gateway unreachable</span> :
          <div className="row"><span className="pill UP">gateway UP</span>{health.services.map((s) => <span key={s.name} className={`pill ${s.status}`}>{s.name} {s.status}{s.latencyMs != null ? ` ${s.latencyMs}ms` : ''}</span>)}</div>}</div>
    </main>

    {quick && <div className="drawer" style={{ left: 'auto' }}><div className="row spread"><h3>{quick.name}</h3><button className="ghost" onClick={() => setQuick(null)}>✕</button></div>
      <p className="mut">{quick.description}</p><table><tbody>{Object.entries(quick.specs || {}).map(([k, v]) => <tr key={k}><td>{k}</td><td>{String(v)}</td></tr>)}</tbody></table></div>}

    {open && <div className="drawer"><div className="row spread"><h3>Your cart</h3><button className="ghost" onClick={() => setOpen(false)}>✕</button></div>
      {cart.items.length === 0 ? <p className="mut">Cart is empty</p> : <>
        {cart.items.map((i) => <div className="row spread" key={i.productId} style={{ margin: '10px 0' }}><span>{i.name} × {i.qty}</span><span>${(i.price * i.qty).toFixed(2)} <button className="ghost" onClick={() => remove(i.productId)}>✕</button></span></div>)}
        <hr style={{ borderColor: 'var(--line)' }} />
        <div className="row spread"><span>Subtotal</span><span>${cart.subtotal?.toFixed(2)}</span></div>
        <div className="row spread"><span>Tax</span><span>${cart.tax?.toFixed(2)}</span></div>
        <div className="row spread"><span>Shipping</span><span>${cart.shipping?.toFixed(2)}</span></div>
        <div className="row spread"><b>Total</b><b className="price">${cart.total?.toFixed(2)}</b></div>
        <p className="mut">Test card (ending 0002 = declined):</p><input style={{ width: '100%' }} value={card} onChange={(e) => setCard(e.target.value)} />
        <button style={{ width: '100%', marginTop: 12 }} onClick={checkout}>Checkout</button></>}</div>}
  </>);
}
