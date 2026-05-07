window.AllOperationsView = {
    transactions: [],
    accounts: {},
    pendingFilter: null,  // {category, monthKey} set by AnalyticsView before navigation

    render() {
        return `
            <div id="historyHeader" class="view-header" style="position: sticky; top: -32px; z-index: 10; background-color: var(--bg-base); padding: 32px 0 15px 0; margin-top: -32px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
                <h2 style="margin:0;">📋 <span data-i18n="nav_history">Historique</span></h2>
                <div class="history-filters" style="display:flex; gap:8px; flex:1; max-width:700px; justify-content:flex-end; flex-wrap: wrap;">
                    <input type="text" id="historySearch" class="inline-input" placeholder="Rechercher..." style="min-width:0; flex:1; max-width: 180px;" oninput="window.AllOperationsView.applyFilters()">
                    <input type="month" id="historyMonthFilter" class="inline-input" style="min-width:0; flex:1;" onchange="window.AllOperationsView.applyFilters()" title="Filtrer par mois">
                    <select id="historyTypeFilter" class="inline-input" style="min-width:0; flex:1;" onchange="window.AllOperationsView.applyFilters()">
                        <option value="">Tous les types</option>
                        <option value="Dépenses fixes">Dépenses fixes</option>
                        <option value="Dépenses variables">Dépenses variables</option>
                        <option value="Recettes">Recettes</option>
                        <option value="Transfert">Transfert</option>
                    </select>
                    <select id="historyCategoryFilter" class="inline-input" style="min-width:0; flex:1;" onchange="window.AllOperationsView.applyFilters()">
                        <option value="">Toutes les catégories</option>
                    </select>
                </div>
                <button class="btn btn-primary" onclick="window.TimelineView.showAddRow()">+ Ajouter</button>
            </div>
            <div style="padding-bottom: 20px;">
                <table class="data-table mobile-card-table">
                    <thead>
                        <tr>
                            <th style="min-width: 90px;">Date Saisie</th>
                            <th style="min-width: 90px;">Date Op.</th>
                            <th style="min-width: 150px;">Description</th>
                            <th style="min-width: 80px;">Montant</th>
                            <th style="min-width: 120px;">Type</th>
                            <th style="min-width: 120px; white-space: nowrap;">Catégorie</th>
                            <th style="min-width: 100px;">Rapproché le</th>
                            <th style="min-width: 120px;">Depuis</th>
                            <th style="min-width: 120px;">Vers</th>
                            <th style="min-width: 100px;">Actions</th>
                        </tr>
                    </thead>
                    <tbody id="allOperationsBody">
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
            // Load accounts to map IDs to names
            const accs = await API.get('/api/accounts/');
            this.accounts = {};
            accs.forEach(a => { this.accounts[a.id] = a.name; });

            // Get all operations
            const allTx = await API.get('/api/transactions/?limit=10000');
            // Sort by operation date descending (newest first)
            this.transactions = allTx.sort((a, b) => new Date(b.date_operation) - new Date(a.date_operation));
            
            // Populate category filter
            const categories = [...new Set(this.transactions.map(t => t.category).filter(Boolean))].sort();
            const catSelect = document.getElementById('historyCategoryFilter');
            if (catSelect) {
                const currentVal = catSelect.value;
                catSelect.innerHTML = '<option value="">Toutes les catégories</option>' + 
                    categories.map(c => `<option value="${c}">${c}</option>`).join('');
                catSelect.value = currentVal;
            }

            // Apply pending filter from AnalyticsView drilldown
            if (this.pendingFilter) {
                const pf = this.pendingFilter;
                this.pendingFilter = null;
                // Set category filter
                if (pf.category) {
                    const catSelect = document.getElementById('historyCategoryFilter');
                    if (catSelect) catSelect.value = pf.category;
                }
                // Set month filter
                if (pf.monthKey) {
                    const monthInput = document.getElementById('historyMonthFilter');
                    if (monthInput) monthInput.value = pf.monthKey;
                }
                // Set year in search
                if (pf.year) {
                    const searchInput = document.getElementById('historySearch');
                    if (searchInput) searchInput.value = pf.year;
                }
            }

            this.renderTable();
        } catch (e) {
            console.error("Failed to load operations", e);
        }
    },
    
    applyFilters() {
        this.renderTable(false); // false means don't auto-scroll
    },

    renderTable(autoScroll = true) {
        const tbody = document.getElementById('allOperationsBody');
        if (!tbody) return;
        
        // Read filters
        const searchInput = document.getElementById('historySearch');
        const typeFilter = document.getElementById('historyTypeFilter');
        const catFilter = document.getElementById('historyCategoryFilter');
        
        const q = searchInput ? searchInput.value.toLowerCase() : '';
        const tType = typeFilter ? typeFilter.value : '';
        const tCat = catFilter ? catFilter.value : '';

        // Apply filters
        let filtered = this.transactions;
        if (q) {
            filtered = filtered.filter(tx => 
                (tx.description || '').toLowerCase().includes(q) ||
                (tx.category || '').toLowerCase().includes(q) ||
                (tx.amount || '').toString().includes(q) ||
                (this.accounts[tx.from_account_id] || '').toLowerCase().includes(q) ||
                (this.accounts[tx.to_account_id] || '').toLowerCase().includes(q) ||
                (tx.date_operation || '').includes(q)
            );
        }
        if (tType) {
            filtered = filtered.filter(tx => tx.type === tType);
        }
        if (tCat) {
            filtered = filtered.filter(tx => tx.category === tCat);
        }
        // Month filter (YYYY-MM)
        const monthInput = document.getElementById('historyMonthFilter');
        const tMonth = monthInput ? monthInput.value : '';
        if (tMonth) {
            filtered = filtered.filter(tx => tx.date_operation && tx.date_operation.startsWith(tMonth));
        }
        
        const today = new Date();
        today.setHours(0,0,0,0);
        let foundCurrent = false;

        const html = filtered.map(tx => {
            let idAttr = '';
            if (!foundCurrent) {
                const txDate = new Date(tx.date_operation);
                txDate.setHours(0,0,0,0);
                if (txDate <= today) {
                    idAttr = 'id="current-date-row"';
                    foundCurrent = true;
                }
            }

            const amountColor = tx.type === 'Recettes' ? 'var(--color-income)' : 
                               (tx.type === 'Transfert' ? 'var(--color-transfer)' : 'inherit');
            
            const isReconciled = tx.reconciliation_date ? true : false;
            let rowClass = isReconciled ? 'reconciled-row' : '';
            
            // Highlight non-recurrent operations
            const isRecurrent = tx.recurrence_id || tx.is_monthly || tx.is_yearly;
            if (!isRecurrent) {
                rowClass += ' non-recurrent-row';
            }

            const depuis = this.accounts[tx.from_account_id] || '';
            const vers = this.accounts[tx.to_account_id] || '';

            return `
            <tr data-id="${tx.id}" class="${rowClass}" ${idAttr}>
                <td data-label="Date Saisie">${formatDate(tx.date_saisie)}</td>
                <td data-label="Date Op.">${formatDate(tx.date_operation)}</td>
                <td data-label="Description"><strong>${tx.description}</strong></td>
                <td data-label="Montant">
                    <span class="privacy-blur" style="color: ${amountColor}; font-weight: bold;">${formatCurrency(tx.amount)}</span>
                </td>
                <td data-label="Type">${tx.type}</td>
                <td data-label="Catégorie" style="white-space: nowrap;"><span style="background: var(--bg-base); padding: 2px 6px; border-radius: 4px; font-size: 11px;">${tx.category || '-'}</span></td>
                <td data-label="Rapproché le">${formatDate(tx.reconciliation_date) || '-'}</td>
                <td data-label="Depuis">${depuis}</td>
                <td data-label="Vers">${vers}</td>
                <td data-label="Actions" class="mobile-card-actions">
                    <button class="btn btn-secondary" style="padding: 4px 8px; font-size: 11px;" onclick="window.AllOperationsView.edit(${tx.id})">✏️ Éditer</button>
                    <button class="btn btn-danger" style="padding: 4px 8px; font-size: 11px;" onclick="window.AllOperationsView.delete(${tx.id})">X</button>
                </td>
            </tr>
            `;
        }).join('');

        tbody.innerHTML = html || `<tr><td colspan="10" style="text-align:center; padding: 20px; color: var(--text-muted)">Aucune opération trouvée.</td></tr>`;
        
        // Fix sticky table headers position
        setTimeout(() => {
            const header = document.getElementById('historyHeader');
            const ths = document.querySelectorAll('.data-table th');
            if (header && ths.length) {
                const offset = header.offsetHeight - 32; 
                ths.forEach(th => th.style.top = offset + 'px');
            }
            
            if (autoScroll) {
                const currentPoint = document.getElementById('current-date-row');
                if (currentPoint) {
                    const main = document.querySelector('.app-main');
                    if (main) {
                        main.scrollTo({
                            top: currentPoint.offsetTop - (main.clientHeight / 2) + (currentPoint.offsetHeight / 2),
                            behavior: 'smooth'
                        });
                    }
                }
            }
        }, 50);
    },

    edit(id) {
        const tx = this.transactions.find(t => t.id === id);
        if (tx && window.FormView) {
            window.FormView.openEdit(tx);
        }
    },

    async delete(id) {
        if (await showInlineConfirm('Confirmation', 'Supprimer cette opération ?')) {
            try {
                await API.del(`/api/transactions/${id}`);
                await this.loadData();
                window.app.refreshSidebar();
            } catch (e) {
                console.error(e);
            }
        }
    }
};
