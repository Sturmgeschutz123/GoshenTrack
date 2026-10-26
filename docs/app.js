(() => {
    "use strict";

    const SUPABASE_URL = "https://huwrrykpxosqjhnhoqfi.supabase.co";
    const SUPABASE_KEY = "sb_publishable_DkhyfetatVEKEDBfAdBV9Q_FwP6lWsU";
    const supabaseLib = window.supabase;
    const root = document.getElementById("app");
    const state = {
        client: null,
        session: null,
        profile: null,
        products: [],
        stock: {},
        transactions: [],
        sales: [],
        orders: [],
        accounts: [],
        archive: [],
        tab: location.hash.replace(/^#/, "").split("?")[0] || "dashboard",
        message: null,
        busy: false,
    };

    const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[char]));
    const money = value => "₱" + Number(value || 0).toFixed(2);
    const today = () => new Date().toISOString().slice(0, 10);
    const product = id => state.products.find(item => String(item.product_id) === String(id));
    const productName = id => {
        const item = product(id);
        return item ? `${escapeHtml(item.product_name)} (${escapeHtml(item.size)})` : "Unavailable product";
    };
    const displayName = () => state.profile?.full_name || state.profile?.email || "User";
    const status = value => `<span class="badge badge-${escapeHtml(String(value).toLowerCase().replaceAll(" ", "-"))}">${escapeHtml(value)}</span>`;
    const card = (title, body, extra = "") => `<section class="card ${extra}"><h2>${title}</h2>${body}</section>`;
    const field = (label, input) => `<label class="field">${label}${input}</label>`;
    const table = (headers, rows) => {
        if (!rows.length) return '<p class="empty">Nothing here yet.</p>';
        return `<div class="table-wrap"><table><thead><tr>${headers.map(item => `<th>${escapeHtml(item)}</th>`).join("")}</tr></thead><tbody>${rows.map(row => `<tr>${row.map(cell => `<td>${cell}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
    };
    const hidden = (name, value) => `<input type="hidden" name="${name}" value="${escapeHtml(value)}">`;
    const rpc = async (name, args) => {
        const { data, error } = await state.client.rpc(name, args);
        if (error) throw error;
        return data;
    };

    function showMessage(message, isError = false) {
        state.message = { message, isError };
        render();
    }

    function errorMessage(error) {
        const text = error?.message || "Something went wrong. Please try again.";
        if (/invalid login credentials/i.test(text)) return "Email or password is incorrect.";
        if (/email not confirmed/i.test(text)) return "Confirm your email before signing in.";
        if (/already registered/i.test(text)) return "An account already exists for that email.";
        return text;
    }

    function renderAuth(mode = "login", notice = "") {
        const isRegister = mode === "register";
        const statusLine = notice || state.message?.message || "";
        const errorClass = state.message?.isError ? " error" : "";
        root.innerHTML = `<main class="auth-wrap">
            <section class="auth-card">
                <h1>GoshenTrack</h1>
                <p>${isRegister ? "Create a customer account to place egg orders and track their status." : "Sign in to manage orders, inventory, and sales."}</p>
                ${statusLine ? `<div class="notice${errorClass}" role="status">${escapeHtml(statusLine)}</div>` : ""}
                <form class="auth-form" data-action="${isRegister ? "register" : "login"}">
                    ${isRegister ? `<label>Full name<input name="full_name" maxlength="80" autocomplete="name" required></label>` : ""}
                    <label>Email<input name="email" type="email" autocomplete="email" required></label>
                    <label>Password<input name="password" type="password" minlength="8" autocomplete="${isRegister ? "new-password" : "current-password"}" required></label>
                    ${isRegister ? `<label>Confirm password<input name="password_confirmation" type="password" minlength="8" autocomplete="new-password" required></label>` : ""}
                    <button class="primary full" type="submit" ${state.busy ? "disabled" : ""}>${state.busy ? "Please wait…" : isRegister ? "Create customer account" : "Sign in"}</button>
                </form>
                <a class="login-link" href="#${isRegister ? "login" : "register"}">${isRegister ? "Already have an account? Sign in" : "Create a customer account"}</a>
                <p class="footer-note">Staff and admin access is assigned by an administrator.</p>
            </section>
        </main>`;
        state.message = null;
    }

    function tabs() {
        if (state.profile.role === "customer") {
            return [["dashboard", "Shop & availability"], ["orders", "My orders"]];
        }
        const items = [["dashboard", "Dashboard"], ["inventory", "Stock-in / out"], ["sale", "Record sale"], ["orders", "Customer orders"]];
        if (state.profile.role === "admin") {
            items.push(["reports", "Reports"], ["records", "Edit records"], ["accounts", "Accounts"], ["products", "Products"], ["archive", "Archive"]);
        }
        return items;
    }

    function renderShell(content) {
        const message = state.message
            ? `<div class="notice${state.message.isError ? " error" : ""}" role="status">${escapeHtml(state.message.message)}</div>`
            : "";
        const activeTab = tabs().find(([key]) => key === state.tab);
        const pageTitle = activeTab ? activeTab[1] : "Dashboard";
        const icons = {
            dashboard: "▦", inventory: "◫", sale: "₱", orders: "▤",
            reports: "▥", records: "✎", accounts: "◉", products: "◌", archive: "▣",
        };
        const initials = displayName().split(/\s+/).map(part => part[0]).join("").slice(0, 2).toUpperCase();
        root.innerHTML = `<div class="app-layout">
            <aside class="sidebar">
                <a class="brand" href="#dashboard" aria-label="GoshenTrack dashboard">
                    <span class="brand-mark" aria-hidden="true">G</span>
                    <span class="brand-copy"><strong>GoshenTrack</strong><small>Inventory &amp; sales</small></span>
                </a>
                <nav class="nav" aria-label="Main navigation">${tabs().map(([key, label]) => `<button type="button" data-tab="${key}" class="${state.tab === key ? "selected" : ""}"${state.tab === key ? ' aria-current="page"' : ""}><span class="nav-icon" aria-hidden="true">${icons[key]}</span><span>${label}</span></button>`).join("")}</nav>
                <div class="sidebar-footer">
                    <div class="account-chip"><span class="avatar" aria-hidden="true">${escapeHtml(initials)}</span><span class="account-copy"><strong>${escapeHtml(displayName())}</strong><small>${escapeHtml(state.profile.role)}</small></span></div>
                    <form data-action="logout" class="logout-form"><button class="logout-button" type="submit" ${state.busy ? "disabled" : ""}><span aria-hidden="true">↪</span> Log out</button></form>
                </div>
            </aside>
            <div class="workspace">
                <header class="topbar">
                    <div><p class="eyebrow">GOSHENTRACK <span aria-hidden="true">/</span> WORKSPACE</p><h1>${escapeHtml(pageTitle)}</h1></div>
                    <div class="topbar-actions">
                        ${state.profile.role === "admin" && state.tab !== "archive" ? '<button type="button" class="archive-shortcut" data-tab="archive"><span aria-hidden="true">▣</span> Archive</button>' : ""}
                        <span class="topbar-user"><span class="avatar" aria-hidden="true">${escapeHtml(initials)}</span><span>${escapeHtml(displayName())}</span></span>
                    </div>
                </header>
                <main>${message}<div class="page-content ${escapeHtml(state.tab)}">${content}</div></main>
            </div>
        </div>`;
        state.message = null;
    }

    function customerDashboard() {
        const activeProducts = state.products.filter(item => item.active);
        const availability = table(["Product", "Price", "Availability"], activeProducts.map(item => {
            const quantity = state.stock[String(item.product_id)] || 0;
            return [productName(item.product_id), `${money(item.unit_price)} / egg`, quantity > 0 ? `${quantity} available` : status("Out of stock")];
        }));
        const options = activeProducts.map(item => `<option value="${Number(item.product_id)}">${productName(item.product_id)} · ${money(item.unit_price)}</option>`).join("");
        const orderForm = `<form class="stack" data-action="place-order">
            <div class="fields">
                ${field("Product", `<select name="product_id" required>${options}</select>`)}
                ${field("Quantity", '<input type="number" name="quantity" min="1" value="30" required>')}
                ${field("Your name", `<input name="customer_name" maxlength="120" value="${escapeHtml(displayName())}" required>`)}
                ${field("Contact number", '<input name="contact_number" maxlength="40" required>')}
            </div>
            <button class="primary" type="submit" ${state.busy || !activeProducts.length ? "disabled" : ""}>Place order</button>
            <p class="footer-note">Orders stay Pending until staff reviews them. Order history is private to your account.</p>
        </form>`;
        const recent = state.orders.filter(order => !order.archived_at).slice(0, 5).map(order => [
            `#${Number(order.order_id)}`, productName(order.product_id), Number(order.quantity), status(order.status),
            escapeHtml(new Date(order.order_date).toLocaleString()),
        ]);
        return card("Egg availability", availability)
            + card("Place an order", orderForm)
            + `<section class="card"><div class="card-header"><h2>Recent orders</h2><button type="button" data-tab="orders">View all</button></div>${table(["Order", "Product", "Quantity", "Status", "Placed"], recent)}</section>`;
    }

    function customerOrders() {
        return card("My orders", table(["Order", "Product", "Quantity", "Status", "Placed", "Reviewed"], state.orders.filter(order => !order.archived_at).map(order => [
            `#${Number(order.order_id)}`, productName(order.product_id), Number(order.quantity), status(order.status),
            escapeHtml(new Date(order.order_date).toLocaleString()),
            order.reviewed_at ? escapeHtml(new Date(order.reviewed_at).toLocaleString()) : "—",
        ])));
    }

    function dashboard() {
        const period = ["1", "7", "30", "all"].includes(new URLSearchParams(location.hash.split("?")[1] || "").get("period")) ?
            new URLSearchParams(location.hash.split("?")[1] || "").get("period") : "7";
        const start = period === "all" ? "0000-01-01" : new Date(Date.now() - (Number(period) - 1) * 86400000).toISOString().slice(0, 10);
        const sales = state.sales.filter(item => item.sale_date >= start && item.sale_date <= today());
        const pending = state.orders.filter(item => !item.archived_at && item.status === "Pending").length;
        const lowStock = state.products.filter(item => item.active).map(item => {
            const stockCount = Number(state.stock[String(item.product_id)] || 0);
            return `<div class="stat${stockCount < 50 ? " low" : ""}">${productName(item.product_id)}<b>${stockCount}</b></div>`;
        }).join("");
        const stats = `<div class="grid">
            <div class="stat">Sales total<b>${money(sales.reduce((sum, item) => sum + Number(item.total_amount), 0))}</b></div>
            <div class="stat">Eggs sold<b>${sales.reduce((sum, item) => sum + Number(item.quantity), 0)}</b></div>
            <div class="stat">Transactions<b>${sales.length}</b></div>
            <div class="stat${pending ? " low" : ""}">Pending orders<b>${pending}</b></div>
        </div>`;
        const periodSelect = `<label class="field">Period<select data-period>${[["1", "Today"], ["7", "Last 7 days"], ["30", "Last 30 days"], ["all", "All time"]].map(([value, label]) => `<option value="${value}" ${period === value ? "selected" : ""}>${label}</option>`).join("")}</select></label>`;
        const orders = state.orders.filter(order => !order.archived_at).slice(0, 8).map(order => [
            `#${Number(order.order_id)}`, escapeHtml(order.customer_name), productName(order.product_id),
            Number(order.quantity), status(order.status), order.status === "Pending" ? orderAction(order.order_id, "confirm") + orderAction(order.order_id, "decline") : "",
        ]);
        return card("Current stock <span class=\"footer-note\">Highlighted products are below 50 eggs.</span>", `<div class="grid">${lowStock || '<p class="empty">No active products.</p>'}</div>`)
            + `<section class="card"><div class="card-header"><h2>Sales summary</h2>${periodSelect}</div>${stats}</section>`
            + card("Recent customer orders", table(["Order", "Customer", "Product", "Qty", "Status", "Review"], orders));
    }

    function orderAction(id, decision) {
        const label = decision === "confirm" ? "Confirm" : "Decline";
        return `<form class="inline" data-action="review-order">${hidden("order_id", id)}${hidden("decision", decision)}<button type="submit" ${state.busy ? "disabled" : ""}>${label}</button></form>`;
    }

    function archiveAction(type, id, summary) {
        if (state.profile.role !== "admin") return "";
        return `<form class="inline" data-action="archive-record">${hidden("kind", type)}${hidden("id", id)}${hidden("summary", summary)}<button type="submit" ${state.busy ? "disabled" : ""}>Archive</button></form>`;
    }

    function archivePage() {
        const labels = { inventory: "Inventory", sale: "Sale", order: "Customer order", account: "Account" };
        const rows = state.archive.map(item => [
            escapeHtml(labels[item.record_type] || item.record_type),
            escapeHtml(item.summary),
            escapeHtml(new Date(item.archived_at).toLocaleString()),
            `<div class="inline">
                <form class="inline" data-action="restore-record">${hidden("kind", item.record_type)}${hidden("id", item.record_id)}<button type="submit" ${state.busy ? "disabled" : ""}>Restore</button></form>
                <form class="inline" data-action="purge-record">${hidden("kind", item.record_type)}${hidden("id", item.record_id)}${hidden("summary", item.summary)}<button class="danger" type="submit" ${state.busy ? "disabled" : ""}>Permanently delete</button></form>
            </div>`,
        ]);
        return card("Archived records", '<p class="footer-note">Archived items remain included in stock and report totals until permanently deleted. Deleting an order also deletes its linked sale. Deleting an account permanently removes its orders, sales, and inventory transactions; stock totals are checked before removal.</p>'
            + table(["Type", "Record", "Archived", "Actions"], rows));
    }

    function inventoryPage() {
        const products = state.products.map(item => `<option value="${Number(item.product_id)}">${productName(item.product_id)} · ${Number(state.stock[String(item.product_id)] || 0)} in stock</option>`).join("");
        const form = `<form class="stack" data-action="inventory"><div class="fields">
            ${field("Product", `<select name="product_id" required>${products}</select>`)}
            ${field("Transaction type", '<select name="transaction_type"><option>In</option><option>Out</option><option>Adjust</option></select>')}
            ${field("Quantity", '<input type="number" name="quantity" min="1" required>')}
            ${field("Reason", '<input name="reason" maxlength="240" placeholder="e.g. stock received or damaged" required>')}
            ${field("Date", `<input type="date" name="transaction_date" value="${today()}" required>`)}
        </div><button class="primary" type="submit" ${state.busy ? "disabled" : ""}>Save transaction</button></form>`;
        const activeTransactions = state.transactions.filter(item => !item.archived_at);
        const rows = activeTransactions.slice(0, 30).map(item => [
            escapeHtml(item.transaction_date), productName(item.product_id), escapeHtml(item.transaction_type),
            Number(item.quantity), escapeHtml(item.reason),
            ...(state.profile.role === "admin" ? [archiveAction("inventory", item.transaction_id, `${item.transaction_type} · ${item.quantity} eggs · ${item.reason}`)] : []),
        ]);
        return card("Record stock-in, stock-out, or adjustment", form) + card("Recent inventory transactions", table(["Date", "Product", "Type", "Quantity", "Reason", ...(state.profile.role === "admin" ? ["Archive"] : [])], rows));
    }

    function salesPage() {
        const products = state.products.filter(item => item.active).map(item => `<option value="${Number(item.product_id)}">${productName(item.product_id)} · ${money(item.unit_price)}</option>`).join("");
        const form = `<form class="stack" data-action="sale"><div class="fields">
            ${field("Product", `<select name="product_id" required>${products}</select>`)}
            ${field("Quantity", '<input type="number" name="quantity" min="1" required>')}
            ${field("Customer name", '<input name="customer_name" maxlength="120" required>')}
            ${field("Contact number", '<input name="contact_number" maxlength="40">')}
        </div><button class="primary" type="submit" ${state.busy || !products ? "disabled" : ""}>Save sale</button></form>`;
        const rows = state.sales.filter(item => !item.archived_at).slice(0, 30).map(item => [
            escapeHtml(item.sale_date), productName(item.product_id), Number(item.quantity),
            escapeHtml(item.customer_name), money(item.total_amount),
            ...(state.profile.role === "admin" ? [archiveAction("sale", item.sale_id, `${item.customer_name} · ${item.quantity} eggs · ${money(item.total_amount)}`)] : []),
        ]);
        return card("Record sale", form) + card("Recent sales", table(["Date", "Product", "Quantity", "Customer", "Total", ...(state.profile.role === "admin" ? ["Archive"] : [])], rows));
    }

    function staffOrders() {
        const rows = state.orders.filter(order => !order.archived_at).map(order => [
            `#${Number(order.order_id)}`, `${escapeHtml(order.customer_name)} · ${escapeHtml(order.contact_number)}`,
            productName(order.product_id), Number(order.quantity), status(order.status),
            escapeHtml(new Date(order.order_date).toLocaleString()),
            order.status === "Pending" ? orderAction(order.order_id, "confirm") + orderAction(order.order_id, "decline") : "",
            ...(state.profile.role === "admin" ? [archiveAction("order", order.order_id, `${order.customer_name} · ${order.quantity} eggs · ${order.status}`)] : []),
        ]);
        return card("Customer orders", table(["Order", "Customer · Contact", "Product", "Quantity", "Status", "Placed", "Review", ...(state.profile.role === "admin" ? ["Archive"] : [])], rows));
    }

    function reports() {
        const query = new URLSearchParams(location.hash.split("?")[1] || "");
        const type = query.get("type") === "inventory" ? "inventory" : "sales";
        const from = query.get("from") || today().slice(0, 8) + "01";
        const to = query.get("to") || today();
        const form = `<form class="fields" data-action="report-filter">
            ${field("Type", `<select name="type"><option value="sales" ${type === "sales" ? "selected" : ""}>Sales</option><option value="inventory" ${type === "inventory" ? "selected" : ""}>Inventory</option></select>`)}
            ${field("From", `<input type="date" name="from" value="${escapeHtml(from)}" required>`)}
            ${field("To", `<input type="date" name="to" value="${escapeHtml(to)}" required>`)}
            <button class="primary" type="submit">Filter</button></form>`;
        if (from > to) return card("Reports", form + '<p class="notice error">Choose a valid date range.</p>');
        if (type === "sales") {
            const list = state.sales.filter(item => item.sale_date >= from && item.sale_date <= to);
            const rows = list.map(item => [escapeHtml(item.sale_date), productName(item.product_id), Number(item.quantity), escapeHtml(item.customer_name), money(item.total_amount)]);
            const summary = `<p><strong>${list.reduce((sum, item) => sum + Number(item.quantity), 0)} eggs · ${money(list.reduce((sum, item) => sum + Number(item.total_amount), 0))}</strong></p>`;
            return card("Reports", form + table(["Date", "Product", "Quantity", "Customer", "Total"], rows) + summary);
        }
        const rows = state.products.map(item => {
            const tx = state.transactions.filter(row => String(row.product_id) === String(item.product_id) && row.transaction_date >= from && row.transaction_date <= to);
            const sales = state.sales.filter(row => String(row.product_id) === String(item.product_id) && row.sale_date >= from && row.sale_date <= to);
            return [productName(item.product_id), tx.filter(row => row.transaction_type === "In").reduce((sum, row) => sum + Number(row.quantity), 0),
                tx.filter(row => row.transaction_type !== "In").reduce((sum, row) => sum + Number(row.quantity), 0),
                sales.reduce((sum, row) => sum + Number(row.quantity), 0), Number(state.stock[String(item.product_id)] || 0)];
        });
        return card("Reports", form + table(["Product", "Stock-in", "Stock-out / Adjust", "Sold", "On hand"], rows));
    }

    function records() {
        const transactions = state.transactions.filter(item => !item.archived_at).map(item => {
            const form = `<form class="inline" data-action="edit-record">${hidden("kind", "inventory")}${hidden("id", item.transaction_id)}<input aria-label="New quantity" name="quantity" type="number" min="1" value="${Number(item.quantity)}" required><button type="submit">Save qty</button></form>${archiveAction("inventory", item.transaction_id, `${item.transaction_type} · ${item.quantity} eggs · ${item.reason}`)}`;
            return [escapeHtml(item.transaction_date), productName(item.product_id), escapeHtml(item.transaction_type), Number(item.quantity), escapeHtml(item.reason), form];
        });
        const sales = state.sales.filter(item => !item.archived_at).map(item => {
            const controls = item.order_id
                ? '<span class="muted">Order-linked</span>'
                : `<form class="inline" data-action="edit-record">${hidden("kind", "sale")}${hidden("id", item.sale_id)}<input aria-label="New quantity" name="quantity" type="number" min="1" value="${Number(item.quantity)}" required><button type="submit">Save qty</button></form>`;
            const actions = item.order_id ? archiveAction("order", item.order_id, `${item.customer_name} · ${item.quantity} eggs · Confirmed`) : archiveAction("sale", item.sale_id, `${item.customer_name} · ${item.quantity} eggs · ${money(item.total_amount)}`);
            return [escapeHtml(item.sale_date), productName(item.product_id), Number(item.quantity), escapeHtml(item.customer_name), money(item.total_amount), `<div class="inline">${controls}${actions}</div>`];
        });
        return card("Inventory records", table(["Date", "Product", "Type", "Quantity", "Reason", "Admin actions"], transactions))
            + card("Sales records", table(["Date", "Product", "Quantity", "Customer", "Total", "Admin actions"], sales));
    }

    function accounts() {
        const rows = state.accounts.filter(account => !account.archived_at).map(account => {
            const roles = ["customer", "staff", "admin"].map(role => `<option value="${role}" ${account.role === role ? "selected" : ""}>${role[0].toUpperCase() + role.slice(1)}</option>`).join("");
            const statuses = ["Active", "Inactive"].map(value => `<option value="${value}" ${account.account_status === value ? "selected" : ""}>${value}</option>`).join("");
            const self = account.id === state.session.user.id;
            const controls = `<form class="inline" data-action="update-account">${hidden("id", account.id)}<select name="role" aria-label="Account role" ${self ? "disabled" : ""}>${roles}</select><select name="account_status" aria-label="Account status" ${self ? "disabled" : ""}>${statuses}</select><button type="submit" ${self || state.busy ? "disabled" : ""}>Save</button></form>${archiveAction("account", account.id, `${account.full_name || "Unnamed account"} · ${account.email}`)}`;
            return [escapeHtml(account.full_name), escapeHtml(account.email), escapeHtml(account.role), status(account.account_status), controls];
        });
        return card("Accounts", '<p class="footer-note">Users sign up as customers. Assign staff/admin roles here. Role and account status are also enforced by Supabase policies.</p>' + table(["Name", "Email", "Role", "Status", "Update access"], rows));
    }

    function productsPage() {
        const add = `<form class="fields" data-action="add-product">
            ${field("Product name", '<input name="product_name" maxlength="80" required>')}
            ${field("Size", '<input name="size" maxlength="20" required>')}
            ${field("Price per egg", '<input name="unit_price" type="number" min="0" step="0.01" required>')}
            <button class="primary" type="submit" ${state.busy ? "disabled" : ""}>Add product</button>
        </form>`;
        const rows = state.products.map(item => {
            const controls = `<form class="inline" data-action="update-product">${hidden("id", item.product_id)}<input name="unit_price" type="number" min="0" step="0.01" value="${Number(item.unit_price).toFixed(2)}" aria-label="Price" required><select name="active" aria-label="Availability"><option value="true" ${item.active ? "selected" : ""}>Available</option><option value="false" ${!item.active ? "selected" : ""}>Unavailable</option></select><button type="submit" ${state.busy ? "disabled" : ""}>Save</button></form>`;
            return [`${escapeHtml(item.product_name)} (${escapeHtml(item.size)})`, Number(state.stock[String(item.product_id)] || 0), money(item.unit_price), status(item.active ? "Active" : "Inactive"), controls];
        });
        return card("Add product", add) + card("Products and availability", table(["Product", "In stock", "Price", "Availability", "Update"], rows));
    }

    function render() {
        root.classList.remove("loading");
        if (!state.profile) {
            const mode = location.hash === "#register" ? "register" : "login";
            renderAuth(mode);
            return;
        }
        const allowed = tabs().map(([tab]) => tab);
        if (!allowed.includes(state.tab)) state.tab = "dashboard";
        let content;
        if (state.profile.role === "customer") {
            content = state.tab === "orders" ? customerOrders() : customerDashboard();
        } else {
            const views = {
                dashboard,
                inventory: inventoryPage,
                orders: staffOrders,
                sale: salesPage,
                reports,
                records,
                accounts,
                products: productsPage,
                archive: archivePage,
            };
            content = (views[state.tab] || dashboard)();
        }
        renderShell(content);
    }

    async function loadData() {
        const role = state.profile.role;
        const [products, stocks] = await Promise.all([
            fetchAll("products", "product_id,product_name,size,unit_price,active", "product_id"),
            state.client.rpc("product_stock_summary"),
        ]);
        if (stocks.error) throw stocks.error;
        state.products = products;
        state.stock = Object.fromEntries((stocks.data || []).map(item => [String(item.product_id), Number(item.on_hand)]));

        const [orders, transactions, sales, accounts] = await Promise.all([
            role === "customer"
                ? fetchAll("customer_orders", "order_id,product_id,customer_name,contact_number,quantity,status,order_date,reviewed_at,archived_at", "order_date", false, [["customer_id", state.session.user.id]])
                : fetchAll("customer_orders", "order_id,product_id,customer_name,contact_number,quantity,status,order_date,reviewed_at,archived_at", "order_date", false),
            role === "customer" ? Promise.resolve([])
                : fetchAll("inventory_transactions", "transaction_id,product_id,user_id,transaction_type,quantity,reason,transaction_date,archived_at", "transaction_id"),
            role === "customer" ? Promise.resolve([])
                : fetchAll("sales", "sale_id,product_id,user_id,order_id,customer_name,customer_contact,quantity,unit_price,total_amount,sale_date,archived_at", "sale_id"),
            role === "admin" ? fetchAll("profiles", "id,email,full_name,role,account_status,created_at,archived_at", "created_at", false)
                : Promise.resolve([]),
        ]);
        state.orders = orders;
        state.transactions = transactions;
        state.sales = sales;
        state.accounts = accounts;
        if (role === "admin") {
            const { data, error } = await state.client.rpc("admin_list_archive");
            if (error) throw error;
            state.archive = data || [];
        } else {
            state.archive = [];
        }
    }

    async function fetchAll(tableName, columns, orderColumn, ascending = true, filters = []) {
        const pageSize = 500;
        const rows = [];
        for (let start = 0; ; start += pageSize) {
            let query = state.client.from(tableName).select(columns).order(orderColumn, { ascending });
            for (const [column, value] of filters) query = query.eq(column, value);
            const { data, error } = await query.range(start, start + pageSize - 1);
            if (error) throw error;
            rows.push(...(data || []));
            if (!data || data.length < pageSize) return rows;
        }
    }

    async function establishSession(session) {
        state.session = session;
        if (!session) {
            state.profile = null;
            render();
            return;
        }
        const { data, error } = await state.client.from("profiles")
            .select("id,email,full_name,role,account_status")
            .eq("id", session.user.id).maybeSingle();
        if (error) throw error;
        if (!data || data.account_status !== "Active") {
            await state.client.auth.signOut();
            state.session = null;
            state.profile = null;
            state.message = { message: data ? "This account is inactive. Contact an administrator." : "Your profile is missing. Ask an administrator to check the Supabase setup.", isError: true };
            render();
            return;
        }
        state.profile = data;
        const roleTab = { customer: "dashboard", staff: "dashboard", admin: "dashboard" }[data.role];
        state.tab = roleTab;
        try {
            await loadData();
            location.hash = "#dashboard";
            render();
        } catch (error) {
            state.message = { message: `Could not load GoshenTrack data: ${errorMessage(error)}`, isError: true };
            render();
        }
    }

    async function handleSubmit(form) {
        if (state.busy) return;
        const action = form.dataset.action;
        const values = Object.fromEntries(new FormData(form).entries());
        state.busy = true;
        render();
        try {
            if (action === "register") {
                if (values.password !== values.password_confirmation) throw new Error("Passwords do not match.");
                const redirectTo = location.href.split("#")[0];
                const { error } = await state.client.auth.signUp({
                    email: values.email.trim(),
                    password: values.password,
                    options: {
                        data: { full_name: values.full_name.trim() },
                        emailRedirectTo: redirectTo,
                    },
                });
                if (error) throw error;
                state.busy = false;
                state.message = { message: "Account created. Check your email if confirmation is required, then sign in.", isError: false };
                location.hash = "#login";
                render();
                return;
            }
            if (action === "login") {
                const { data, error } = await state.client.auth.signInWithPassword({
                    email: values.email.trim(),
                    password: values.password,
                });
                if (error) throw error;
                state.busy = false;
                await establishSession(data.session);
                return;
            }
            if (action === "logout") {
                const { error } = await state.client.auth.signOut();
                if (error) throw error;
                state.session = null;
                state.profile = null;
                state.busy = false;
                location.hash = "#login";
                render();
                return;
            }
            if (action === "place-order") {
                await rpc("place_customer_order", {
                    p_product_id: Number(values.product_id),
                    p_quantity: Number(values.quantity),
                    p_customer_name: values.customer_name.trim(),
                    p_contact_number: values.contact_number.trim(),
                });
                state.tab = "orders";
                await afterMutation("Order placed. Its status is Pending until staff reviews it.");
                return;
            }
            if (action === "inventory") {
                await rpc("record_inventory_transaction", {
                    p_product_id: Number(values.product_id),
                    p_transaction_type: values.transaction_type,
                    p_quantity: Number(values.quantity),
                    p_reason: values.reason.trim(),
                    p_transaction_date: values.transaction_date,
                });
                state.tab = "inventory";
                await afterMutation("Inventory transaction saved.");
                return;
            }
            if (action === "sale") {
                await rpc("record_sale", {
                    p_product_id: Number(values.product_id),
                    p_quantity: Number(values.quantity),
                    p_customer_name: values.customer_name.trim(),
                    p_customer_contact: (values.contact_number || "").trim(),
                });
                state.tab = "sale";
                await afterMutation("Sale recorded and stock updated.");
                return;
            }
            if (action === "review-order") {
                await rpc("review_customer_order", {
                    p_order_id: Number(values.order_id),
                    p_confirm: values.decision === "confirm",
                });
                state.tab = "orders";
                await afterMutation(`Order ${values.decision === "confirm" ? "confirmed" : "declined"}.`);
                return;
            }
            if (action === "archive-record" || action === "restore-record" || action === "purge-record") {
                if (state.profile.role !== "admin") throw new Error("Admin access is required.");
                if (action === "purge-record") {
                    let impact = "This permanently removes the archived record and cannot be undone.";
                    if (values.kind === "order") impact += " Any linked sale will also be permanently deleted.";
                    if (values.kind === "sale") impact += " Its linked customer order, if any, will also be permanently deleted.";
                    if (values.kind === "account") impact += " The account and its customer orders, sales, and inventory transactions will also be permanently deleted.";
                    if (!confirm(`${impact}\n\n${values.summary}`) || prompt('Type DELETE to confirm permanent removal.') !== "DELETE") {
                        state.busy = false;
                        render();
                        return;
                    }
                }
                const recordAction = action === "archive-record" ? "archive" : action === "restore-record" ? "restore" : "delete";
                await rpc("admin_manage_archived_record", {
                    p_record_type: values.kind,
                    p_record_id: values.id,
                    p_action: recordAction,
                });
                await afterMutation(recordAction === "archive" ? "Record moved to the archive."
                    : recordAction === "restore" ? "Record restored."
                        : "Archived record permanently deleted.");
                return;
            }
            if (action === "edit-record") {
                await rpc("admin_modify_record", {
                    p_kind: values.kind,
                    p_id: Number(values.id),
                    p_new_quantity: Number(values.quantity),
                    p_delete: false,
                });
                state.tab = "records";
                await afterMutation("Record quantity updated.");
                return;
            }
            if (action === "update-account") {
                const { error } = await state.client.from("profiles")
                    .update({ role: values.role, account_status: values.account_status })
                    .eq("id", values.id);
                if (error) throw error;
                state.tab = "accounts";
                await afterMutation("Account access updated.");
                return;
            }
            if (action === "add-product") {
                const { error } = await state.client.from("products").insert({
                    product_name: values.product_name.trim(),
                    size: values.size.trim(),
                    unit_price: Number(values.unit_price),
                });
                if (error) throw error;
                state.tab = "products";
                await afterMutation("Product added.");
                return;
            }
            if (action === "update-product") {
                const { error } = await state.client.from("products")
                    .update({ unit_price: Number(values.unit_price), active: values.active === "true" })
                    .eq("product_id", Number(values.id));
                if (error) throw error;
                state.tab = "products";
                await afterMutation("Product updated.");
                return;
            }
            if (action === "report-filter") {
                const params = new URLSearchParams({
                    type: values.type,
                    from: values.from,
                    to: values.to,
                });
                state.busy = false;
                location.hash = `#reports?${params.toString()}`;
                render();
                return;
            }
            state.busy = false;
        } catch (error) {
            state.busy = false;
            state.message = { message: errorMessage(error), isError: true };
            render();
        }
    }

    async function afterMutation(message) {
        await loadData();
        state.busy = false;
        state.message = { message, isError: false };
        location.hash = `#${state.tab}`;
        render();
    }

    root.addEventListener("submit", event => {
        event.preventDefault();
        handleSubmit(event.target);
    });
    root.addEventListener("click", event => {
        const button = event.target.closest("[data-tab]");
        if (button) {
            state.tab = button.dataset.tab;
            location.hash = `#${state.tab}`;
            render();
        }
    });
    root.addEventListener("change", event => {
        if (event.target.matches("[data-period]")) {
            const params = new URLSearchParams();
            params.set("period", event.target.value);
            location.hash = `#dashboard?${params.toString()}`;
            render();
        }
    });
    window.addEventListener("hashchange", () => {
        const [tab, query] = location.hash.slice(1).split("?");
        if (tab === "login" || tab === "register") {
            if (!state.profile) render();
            return;
        }
        if (tab && tabs().some(([key]) => key === tab)) {
            state.tab = tab;
            if (query) location.hash = `#${tab}?${query}`;
            render();
        }
    });

    if (!supabaseLib?.createClient) {
        root.textContent = "Could not load the Supabase client library. Check your internet connection and reload.";
        return;
    }

    state.client = supabaseLib.createClient(SUPABASE_URL, SUPABASE_KEY, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });
    state.client.auth.onAuthStateChange((event, session) => {
        if (event === "SIGNED_OUT") {
            state.session = null;
            state.profile = null;
            state.tab = "dashboard";
            render();
        }
    });
    state.client.auth.getSession().then(({ data, error }) => {
        if (error) throw error;
        return establishSession(data.session);
    }).catch(error => {
        state.message = { message: `Supabase connection failed: ${errorMessage(error)}`, isError: true };
        renderAuth("login");
    });
})();
