// budgets.js — Système de Budgets (Enveloppes)
window.BudgetsView = {
    budgets: [],
    categories: [],
    statusData: null,

    render() {
        return `
        <div>
            <div class="view-header" style="position:sticky;top:-32px;z-index:10;background:var(--bg-base);padding:32px 0 15px;margin-top:-32px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;">
                <h2 style="margin:0;">🎯 Budgets par Enveloppe</h2>
                <div style="display:flex;gap:10px;align-items:center;">
                    <input type="month" id="budgetMonth" class="inline-input" style="width:160px;" onchange="window.BudgetsView.loadStatus()">
                    <button class="btn btn-primary" onclick="window.BudgetsView.showAddForm()">+ Ajouter un budget</button>
                </div>
            </div>

            <!-- Status this month -->
            <div id="budgetStatusContainer" style="margin-bottom:30px;"></div>

            <!-- Budget config table -->
            <div style="margin-bottom:12px;display:flex;justify-content:space-between;align-items:center;">
                <h3 style="margin:0;font-size:14px;color:var(--text-muted);">Configuration des enveloppes</h3>
            </div>
            <div id="budgetConfigContainer"></div>

            <!-- Add form -->
            <div id="budgetAddForm" style="display:none;margin-top:20px;background:var(--bg-body);border:1px solid var(--border-color);border-radius:10px;padding:20px;">
                <h4 style="margin:0 0 15px;">Nouvelle enveloppe</h4>
                <div style="display:grid;grid-template-columns:1fr 1fr auto;gap:12px;align-items:end;">
                    <div>
                        <label style="font-size:12px;color:var(--text-muted);">Catégorie</label>
                        <select id="newBudgetCat" class="inline-input" style="width:100%;margin-top:4px;"></select>
                    </div>
                    <div>
                        <label style="font-size:12px;color:var(--text-muted);">Montant mensuel (€)</label>
                        <input type="number" id="newBudgetAmount" class="inline-input" placeholder="0.00" style="width:100%;margin-top:4px;" min="0" step="0.01">
                    </div>
                    <div style="display:flex;gap:8px;">
                        <button class="btn btn-primary" onclick="window.BudgetsView.saveBudget()">Ajouter</button>
                        <button class="btn btn-secondary" onclick="window.BudgetsView.hideAddForm()">Annuler</button>
                    </div>
                </div>
            </div>
        </div>`;
    },

    async init() {
        // Set month picker to current month
        const now = new Date();
        document.getElementById('budgetMonth').value = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
        await Promise.all([this.loadBudgets(), this.loadCategories(), this.loadStatus()]);
    },

    async loadBudgets() {
        this.budgets = await API.get('/api/budgets/');
        this.renderConfig();
    },

    async loadCategories() {
        this.categories = await API.get('/api/categories/');
        const sel = document.getElementById('newBudgetCat');
        if (sel) {
            sel.innerHTML = this.categories.map(c => `<option value="${c.name}">${c.name}</option>`).join('');
        }
    },

    async loadStatus() {
        const monthVal = document.getElementById('budgetMonth')?.value;
        if (!monthVal) return;
        const [y, m] = monthVal.split('-');
        try {
            this.statusData = await API.get(`/api/budgets/status?year=${y}&month=${m}`);
            this.renderStatus();
        } catch(e) {
            document.getElementById('budgetStatusContainer').innerHTML =
                `<p style="color:var(--color-expense);">Erreur : ${e.message}</p>`;
        }
    },

    renderStatus() {
        const container = document.getElementById('budgetStatusContainer');
        if (!this.statusData || this.statusData.budgets.length === 0) {
            container.innerHTML = '<p style="color:var(--text-muted);padding:10px 0;">Aucun budget configuré. Ajoutez des enveloppes pour commencer.</p>';
            return;
        }

        const monthVal = document.getElementById('budgetMonth')?.value || '';
        const [y, m] = monthVal.split('-');
        const label = new Date(parseInt(y), parseInt(m)-1, 1).toLocaleDateString('fr-FR', {month:'long', year:'numeric'});

        let html = `<h3 style="margin:0 0 15px;font-size:14px;color:var(--text-muted);">État — ${label}</h3>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:16px;">`;

        for (const b of this.statusData.budgets) {
            const pct = Math.min(b.percent, 100);
            const color = pct >= 100 ? 'var(--color-expense)' : pct >= 80 ? '#f59e0b' : '#10b981';
            const overBudget = b.remaining < 0;
            html += `<div style="background:var(--bg-body);border:1px solid ${overBudget ? 'rgba(239,68,68,0.4)' : 'var(--border-color)'};border-radius:10px;padding:16px;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
                    <strong style="font-size:13px;">${b.category_name}</strong>
                    <span class="privacy-blur" style="font-size:11px;color:var(--text-muted);">${formatCurrency(b.budget_amount)}/mois</span>
                </div>
                <div style="background:var(--bg-base);border-radius:999px;height:8px;overflow:hidden;margin-bottom:8px;">
                    <div style="width:${pct}%;height:100%;background:${color};border-radius:999px;transition:width 0.6s ease;"></div>
                </div>
                <div style="display:flex;justify-content:space-between;font-size:12px;">
                    <span class="privacy-blur" style="color:${color};font-weight:600;">${formatCurrency(b.spent)} dépensés</span>
                    <span style="color:${overBudget ? 'var(--color-expense)' : 'var(--text-muted)'};">${overBudget ? '⚠️ ' : ''}<span class="privacy-blur">${formatCurrency(Math.abs(b.remaining))}</span> ${overBudget ? 'de dépassement' : 'restants'}</span>
                </div>
            </div>`;
        }
        html += '</div>';
        container.innerHTML = html;
    },

    renderConfig() {
        const container = document.getElementById('budgetConfigContainer');
        if (!this.budgets || this.budgets.length === 0) {
            container.innerHTML = '<p style="color:var(--text-muted);">Aucun budget défini.</p>';
            return;
        }
        let html = `<table class="data-table"><thead><tr>
            <th>Catégorie</th><th style="text-align:right;">Montant mensuel</th><th style="text-align:right;">Période</th><th></th>
        </tr></thead><tbody>`;
        for (const b of this.budgets) {
            html += `<tr>
                <td>${b.category_name}</td>
                <td style="text-align:right;">
                    <input type="number" class="inline-input" style="width:100px;text-align:right;" value="${b.monthly_amount}"
                        onchange="window.BudgetsView.updateAmount(${b.id}, this.value)">
                </td>
                <td style="text-align:right;color:var(--text-muted);font-size:12px;">${b.period === 'monthly' ? 'Mensuel' : 'Annuel'}</td>
                <td style="text-align:right;">
                    <button class="btn btn-danger" style="padding:2px 8px;font-size:11px;" onclick="window.BudgetsView.deleteBudget(${b.id})">Supprimer</button>
                </td>
            </tr>`;
        }
        html += '</tbody></table>';
        container.innerHTML = html;
    },

    showAddForm() {
        document.getElementById('budgetAddForm').style.display = 'block';
    },

    hideAddForm() {
        document.getElementById('budgetAddForm').style.display = 'none';
    },

    async saveBudget() {
        const cat = document.getElementById('newBudgetCat').value;
        const amount = parseFloat(document.getElementById('newBudgetAmount').value);
        if (!cat || !amount) return;
        try {
            await API.post('/api/budgets/', { category_name: cat, monthly_amount: amount });
            this.hideAddForm();
            await this.loadBudgets();
            await this.loadStatus();
        } catch(e) {
            showInlineMessage('Info', 'Erreur : ' + e.message);
        }
    },

    async updateAmount(id, val) {
        const amount = parseFloat(val);
        if (isNaN(amount)) return;
        try {
            await API.put(`/api/budgets/${id}`, { monthly_amount: amount });
            await this.loadStatus();
        } catch(e) {
            showInlineMessage('Info', 'Erreur mise à jour : ' + e.message);
        }
    },

    async deleteBudget(id) {
        const ok = await showInlineConfirm('Suppression', 'Supprimer ce budget ?');
        if (!ok) return;
        try {
            await API.del(`/api/budgets/${id}`);
            await this.loadBudgets();
            await this.loadStatus();
        } catch(e) {
            showInlineMessage('Info', 'Erreur suppression : ' + e.message);
        }
    }
};
