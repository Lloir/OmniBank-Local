window.AccountsView = {
    accounts: [],
    
    render() {
        return `
            <div class="view-header" style="display:flex; justify-content:space-between; margin-bottom:15px;">
                <h2>🏦 Comptes & Livrets</h2>
            </div>
            
            <div style="margin-bottom: 20px; background: var(--bg-surface); padding: 15px; border-radius: 8px; border: 1px solid var(--border-color);">
                <h3>Nouveau Compte</h3>
                <div class="accounts-add-form" style="display: flex; gap: 10px; margin-top: 10px; flex-wrap: wrap;">
                    <input type="text" id="acc_name" class="inline-input" placeholder="Nom du compte" style="border:1px solid var(--border-color); padding: 5px; flex: 2;">
                    <input type="text" id="acc_type" class="inline-input" placeholder="Type (Ex: Courant, Livret...)" style="border:1px solid var(--border-color); padding: 5px; flex: 1;">
                    <input type="number" id="acc_balance" class="inline-input" placeholder="Solde Initial (€)" step="0.01" style="border:1px solid var(--border-color); padding: 5px; flex: 1;">
                    <button class="btn btn-secondary" onclick="window.AccountsView.addAccount()">Ajouter</button>
                </div>
            </div>

            <div style="overflow-x: auto;">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Nom</th>
                            <th>Type</th>
                            <th>Solde Initial</th>
                            <th style="width: 50px;">Actions</th>
                        </tr>
                    </thead>
                    <tbody id="accountsBody">
                        <!-- Rendered dynamically -->
                    </tbody>
                </table>
            </div>
        `;
    },

    async init() {
        await this.loadData();
    },

    async loadData() {
        try {
            this.accounts = await API.get('/api/accounts/');
            this.renderTable();
        } catch (e) {
            console.error("Failed to load accounts", e);
        }
    },

    renderTable() {
        const tbody = document.getElementById('accountsBody');
        if (!tbody) return;
        
        tbody.innerHTML = this.accounts.map(acc => `
            <tr style="${acc.is_closed ? 'opacity: 0.6;' : ''}">
                <td>
                    <strong>${acc.name}</strong>
                    ${acc.is_closed ? '<span data-i18n="badge_closed" style="background:var(--danger); color:#fff; padding:2px 5px; border-radius:4px; font-size:10px; margin-left:5px; font-weight:bold;">Fermé</span>' : ''}
                </td>
                <td>${acc.type}</td>
                <td><span class="privacy-blur">${formatCurrency(acc.initial_balance)}</span></td>
                <td style="white-space: nowrap;">
                    <button class="btn btn-secondary" style="padding: 2px 6px; font-size: 10px; margin-right: 5px;" onclick="window.AccountsView.edit(${acc.id})" title="Modifier">✏️</button>
                    <button class="btn btn-secondary" style="padding: 2px 6px; font-size: 10px; margin-right: 5px;" onclick="window.AccountsView.toggleClose(${acc.id})" title="${acc.is_closed ? 'Réouvrir' : 'Clôturer'}">${acc.is_closed ? '🔓' : '🔒'}</button>
                    <button class="btn btn-danger" style="padding: 2px 6px; font-size: 10px;" onclick="window.AccountsView.delete(${acc.id})" title="Supprimer">X</button>
                </td>
            </tr>
        `).join('');
        
        if (window.app && window.app.translateDOM) {
            window.app.translateDOM(tbody);
        }
    },

    async addAccount() {
        try {
            const data = {
                name: document.getElementById('acc_name').value,
                type: document.getElementById('acc_type').value || 'Compte courant',
                initial_balance: parseFloat(document.getElementById('acc_balance').value) || 0,
                is_closed: false
            };
            if (!data.name) return await showInlineMessage("Info", "Nom requis");
            
            await API.post('/api/accounts/', data);
            
            document.getElementById('acc_name').value = '';
            document.getElementById('acc_type').value = '';
            document.getElementById('acc_balance').value = '';
            
            await this.loadData();
            window.app.refreshSidebar(); // Refresh left sidebar
        } catch (e) {
            console.error(e);
            showInlineMessage("Info", "Erreur: Impossible de créer le compte");
        }
    },

    async delete(id) {
        if (await showInlineConfirm('Confirmation', 'Supprimer ce compte ? (Impossible si des opérations existent)')) {
            try {
                await API.del(`/api/accounts/${id}`);
                await this.loadData();
                window.app.refreshSidebar();
            } catch (e) {
                console.error(e);
                showInlineMessage("Erreur", "Impossible de supprimer ce compte. S'il contient des opérations, veuillez plutôt le clôturer (🔒).");
            }
        }
    },

    async toggleClose(id) {
        const acc = this.accounts.find(a => a.id === id);
        if (!acc) return;
        
        const action = acc.is_closed ? "réouvrir" : "clôturer";
        if (await showInlineConfirm('Confirmation', `Voulez-vous vraiment ${action} ce compte ?`)) {
            try {
                await API.put(`/api/accounts/${id}`, {
                    name: acc.name,
                    type: acc.type,
                    initial_balance: acc.initial_balance,
                    is_closed: !acc.is_closed
                });
                await this.loadData();
                window.app.refreshSidebar();
            } catch (e) {
                console.error(e);
                showInlineMessage("Erreur", "Une erreur est survenue.");
            }
        }
    },

    async edit(id) {
        const acc = this.accounts.find(a => a.id === id);
        if (!acc) return;
        
        const newBalanceStr = await showInlinePrompt(`Nouveau solde initial pour ${acc.name} (€) :`, acc.initial_balance);
        if (newBalanceStr === null || newBalanceStr.trim() === '') return; // Annulé ou vide
        
        // Remplacer la virgule par un point pour le parsing
        const newBalance = parseFloat(newBalanceStr.replace(',', '.'));
        if (isNaN(newBalance)) return await showInlineMessage("Info", "Montant invalide");
        
        try {
            await API.put(`/api/accounts/${id}`, {
                name: acc.name,
                type: acc.type,
                initial_balance: newBalance,
                is_closed: acc.is_closed
            });
            await this.loadData();
            window.app.refreshSidebar();
        } catch (e) {
            console.error(e);
            showInlineMessage("Info", "Erreur lors de la modification");
        }
    }
};
