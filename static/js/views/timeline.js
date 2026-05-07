window.TimelineView = {
    transactions: [],
    
    render() {
        return `
            <style id="timelineColsStyle"></style>
            <div id="timelineColsModal" class="modal-overlay" style="display: none; z-index: 100;">
                <div class="modal-content" style="max-width: 300px;">
                    <h3>⚙️ Colonnes</h3>
                    <div style="display:flex; flex-direction:column; gap:10px; margin: 20px 0;">
                        <label><input type="checkbox" id="chk_col_dateSaisie" onchange="window.TimelineView.toggleCol('dateSaisie')"> Date Saisie</label>
                        <label><input type="checkbox" id="chk_col_date" onchange="window.TimelineView.toggleCol('date')"> Date Op.</label>
                        <label><input type="checkbox" id="chk_col_desc" onchange="window.TimelineView.toggleCol('desc')"> Description</label>
                        <label><input type="checkbox" id="chk_col_type" onchange="window.TimelineView.toggleCol('type')"> Type</label>
                        <label><input type="checkbox" id="chk_col_cat" onchange="window.TimelineView.toggleCol('cat')"> Catégorie</label>
                        <label><input type="checkbox" id="chk_col_amount" onchange="window.TimelineView.toggleCol('amount')"> Montant</label>
                        <label><input type="checkbox" id="chk_col_recon" onchange="window.TimelineView.toggleCol('recon')"> Rapproché</label>
                        <label><input type="checkbox" id="chk_col_depuis" onchange="window.TimelineView.toggleCol('depuis')"> Depuis</label>
                        <label><input type="checkbox" id="chk_col_vers" onchange="window.TimelineView.toggleCol('vers')"> Vers</label>
                        <label><input type="checkbox" id="chk_col_recurrence" onchange="window.TimelineView.toggleCol('recurrence')"> Répétition</label>
                        <label><input type="checkbox" id="chk_col_slip" onchange="window.TimelineView.toggleCol('slip')"> N° Bordereau</label>
                        <label><input type="checkbox" id="chk_col_attachments" onchange="window.TimelineView.toggleCol('attachments')"> P. Jointes</label>
                    </div>
                    <div style="text-align: right;">
                        <button class="btn btn-primary" onclick="document.getElementById('timelineColsModal').style.display='none'">Fermer</button>
                    </div>
                </div>
            </div>
            <div id="timelineHeader" class="view-header" style="position: sticky; top: -32px; z-index: 10; background-color: var(--bg-base); padding: 32px 0 15px 0; margin-top: -32px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
                <h2 style="margin:0;">🏠 <span data-i18n="nav_timeline">Dashboard</span></h2>
                <div style="display:flex; gap:10px; flex:1; max-width:600px; justify-content:flex-end;">
                    <input type="text" id="timelineSearch" class="inline-input" placeholder="Rechercher..." style="max-width: 200px;" oninput="window.TimelineView.applyFilters()">
                    <select id="timelineTypeFilter" class="inline-input" style="width: 140px;" onchange="window.TimelineView.applyFilters()">
                        <option value="">Tous les types</option>
                        <option value="Dépenses fixes">Dépenses fixes</option>
                        <option value="Dépenses variables">Dépenses variables</option>
                        <option value="Recettes">Recettes</option>
                        <option value="Transfert">Transfert</option>
                    </select>
                    <select id="timelineCategoryFilter" class="inline-input" style="width: 140px;" onchange="window.TimelineView.applyFilters()">
                        <option value="">Toutes les catégories</option>
                    </select>
                    <div style="display:flex; align-items:center; gap:8px; margin-left:10px;">
                        <span style="font-size:12px; font-weight:600; color:var(--text-muted); white-space:nowrap;" data-i18n="filter_attachments">Pièces jointes</span>
                        <label class="toggle-switch" style="flex-shrink: 0;" title="Uniquement avec pièces jointes">
                            <input type="checkbox" id="timelineAttachmentFilter" onchange="window.TimelineView.applyFilters()">
                            <span class="slider"></span>
                        </label>
                    </div>
                </div>
                <div style="display:flex; gap:10px;">
                    <button class="btn btn-secondary" onclick="document.getElementById('timelineColsModal').style.display='flex'">⚙️ Colonnes</button>
                    <button class="btn btn-secondary" onclick="window.ImportWizard.open()">📥 Importer (CSV/XLSX)</button>
                    <button class="btn btn-primary" onclick="window.TimelineView.showAddRow()">+ Ajouter</button>
                </div>
            </div>
            <div style="padding-bottom: 20px;">
                <table class="data-table timeline-table">
                    <thead>
                        <tr>
                            <th class="col-dateSaisie" style="width: 100px;">Date Saisie</th>
                            <th class="col-date" style="width: 100px;">Date Op.</th>
                            <th class="col-desc">Description</th>
                            <th class="col-type" style="width: 120px;">Type</th>
                            <th class="col-cat" style="width: 160px; white-space: nowrap;">Catégorie</th>
                            <th class="col-amount" style="width: 100px;">Montant</th>
                            <th class="col-recon" style="width: 120px;">Rapproché</th>
                            <th class="col-depuis" style="width: 120px;">Depuis</th>
                            <th class="col-vers" style="width: 120px;">Vers</th>
                            <th class="col-recurrence" style="width: 100px;">Répétition</th>
                            <th class="col-slip" style="width: 120px;">N° Bordereau</th>
                            <th class="col-attachments" style="width: 100px;">P. Jointes</th>
                            <th class="col-actions" style="width: 50px;"></th>
                        </tr>
                    </thead>
                    <tbody id="timelineBody">
                        <!-- Rendered dynamically -->
                    </tbody>
                </table>
            </div>
        `;
    },

    async init() {
        this.applyColSettings();
        await this.loadData();
    },

    getColSettings() {
        const def = { dateSaisie: false, date: true, desc: true, type: false, cat: true, amount: true, recon: true, depuis: false, vers: false, recurrence: false, slip: false, attachments: false };
        try {
            const saved = localStorage.getItem('timeline_cols');
            return saved ? { ...def, ...JSON.parse(saved) } : def;
        } catch { return def; }
    },

    toggleCol(col) {
        const settings = this.getColSettings();
        const chk = document.getElementById('chk_col_' + col);
        if (chk) {
            settings[col] = chk.checked;
            localStorage.setItem('timeline_cols', JSON.stringify(settings));
            this.applyColSettings();
        }
    },

    applyColSettings() {
        const cols = this.getColSettings();
        
        // Update checkboxes
        Object.keys(cols).forEach(k => {
            const el = document.getElementById('chk_col_' + k);
            if (el) el.checked = cols[k];
        });
        
        // Inject CSS using classes
        let css = '';
        Object.keys(cols).forEach(k => {
            if (!cols[k]) {
                css += `.timeline-table .col-${k} { display: none !important; }\n`;
            }
        });
        
        const styleTag = document.getElementById('timelineColsStyle');
        if (styleTag) styleTag.innerHTML = css;
    },

    async loadData() {
        try {
            // Get all operations and filter in JS
            const allTransactions = await API.get('/api/transactions/?limit=10000');
            
            const now = new Date();
            const currentYear = now.getFullYear();
            const currentMonth = now.getMonth();
            
            let prevYear = currentYear;
            let prevMonth = currentMonth - 1;
            if (prevMonth < 0) {
                prevMonth = 11;
                prevYear -= 1;
            }

            // Filter for dashboard
            this.transactions = allTransactions.filter(tx => {
                // Get next pay date from app
                const nextPayDate = window.app.nextPayDate ? new Date(window.app.nextPayDate) : null;
                const txDate = new Date(tx.date_operation);

                // Keep ALL non-reconciled operations, EXCEPT those AFTER nextPayDate
                if (!tx.reconciliation_date) {
                    if (nextPayDate && txDate > nextPayDate) {
                        return false;
                    }
                    return true;
                }
                
                // Keep reconciled operations ONLY if they are from current or previous month
                const txYear = txDate.getFullYear();
                const txM = txDate.getMonth();
                
                const isCurrentMonth = (txYear === currentYear && txM === currentMonth);
                const isPrevMonth = (txYear === prevYear && txM === prevMonth);
                
                return isCurrentMonth || isPrevMonth;
            });

            // Populate category filter
            const categories = [...new Set(this.transactions.map(t => t.category).filter(Boolean))].sort();
            const catSelect = document.getElementById('timelineCategoryFilter');
            if (catSelect) {
                const currentVal = catSelect.value;
                catSelect.innerHTML = '<option value="">Toutes les catégories</option>' + 
                    categories.map(c => `<option value="${c}">${c}</option>`).join('');
                catSelect.value = currentVal;
            }

            this.renderTable();
        } catch (e) {
            console.error("Failed to load timeline", e);
        }
    },

    applyFilters() {
        this.renderTable(false); // false means don't auto-scroll
    },

    renderTable(autoScroll = true) {
        const tbody = document.getElementById('timelineBody');
        if (!tbody) return;
        
        // Read filters
        const searchInput = document.getElementById('timelineSearch');
        const typeFilter = document.getElementById('timelineTypeFilter');
        const catFilter = document.getElementById('timelineCategoryFilter');
        const attachFilter = document.getElementById('timelineAttachmentFilter');
        
        const q = searchInput ? searchInput.value.toLowerCase() : '';
        const tType = typeFilter ? typeFilter.value : '';
        const tCat = catFilter ? catFilter.value : '';
        const tAttach = attachFilter ? attachFilter.checked : false;

        // Apply filters
        let filtered = this.transactions;
        if (q) {
            filtered = filtered.filter(tx => 
                (tx.description || '').toLowerCase().includes(q) ||
                (tx.category || '').toLowerCase().includes(q) ||
                (tx.amount || '').toString().includes(q)
            );
        }
        if (tType) {
            filtered = filtered.filter(tx => tx.type === tType);
        }
        if (tCat) {
            filtered = filtered.filter(tx => tx.category === tCat);
        }
        if (tAttach) {
            filtered = filtered.filter(tx => !!tx.attachments);
        }

        // Split into unreconciled and reconciled
        const unreconciled = filtered.filter(tx => !tx.reconciliation_date);
        const reconciled = filtered.filter(tx => tx.reconciliation_date);

        // Sort Unreconciled: furthest future to closest (descending date)
        unreconciled.sort((a, b) => new Date(b.date_operation) - new Date(a.date_operation));

        // Sort Reconciled: most recent to oldest (descending date)
        reconciled.sort((a, b) => new Date(b.date_operation) - new Date(a.date_operation));

        const renderRow = (tx) => {
            const isReconciled = tx.reconciliation_date ? true : false;
            const amountColor = tx.type === 'Recettes' ? 'var(--color-income)' : 
                               (tx.type === 'Transfert' ? 'var(--color-transfer)' : 'inherit');
            
            let rowClass = isReconciled ? 'reconciled-row' : '';
            
            // Highlight non-recurrent operations
            const isRecurrent = tx.recurrence_id || tx.is_monthly || tx.is_yearly;
            if (!isRecurrent) {
                rowClass += ' non-recurrent-row';
            }
            
            const idAttr = tx._isFirstReconciled ? 'id="first-reconciled"' : '';
            
            let reconcileHTML = '';
            if (isReconciled) {
                const dateStr = formatDate(tx.reconciliation_date);
                reconcileHTML = `<span style="font-size:12px; cursor:pointer;" onclick="window.TimelineView.toggleReconciliation(${tx.id})" title="Annuler le rapprochement">${dateStr}</span>`;
            } else {
                reconcileHTML = `<button class="btn btn-primary" style="padding: 4px 10px; font-size: 11px; border-radius: 6px;" onclick="window.TimelineView.toggleReconciliation(${tx.id})">Rapprocher</button>`;
            }

            const accounts = window.app.accounts || [];
            const getAccName = (id) => { const a = accounts.find(x => x.id === id); return a ? a.name : '-'; };
            const depuis = tx.from_account_id ? getAccName(tx.from_account_id) : '-';
            const vers = tx.to_account_id ? getAccName(tx.to_account_id) : '-';
            
            let recText = '-';
            if (tx.is_monthly) recText = 'Mensuelle';
            if (tx.is_yearly) recText = 'Annuelle';
            if (tx.is_bimonthly) recText = 'Bi-Mensuelle';

            const attachHtml = tx.attachments ? `<span title="${tx.attachments}">📎 Oui</span>` : '-';

            return `
            <tr data-id="${tx.id}" class="${rowClass}" ${idAttr}>
                <td class="col-dateSaisie">${formatDate(tx.date_saisie)}</td>
                <td class="col-date">${formatDate(tx.date_operation)}</td>
                <td class="col-desc"><strong>${tx.description}</strong></td>
                <td class="col-type">${tx.type || '-'}</td>
                <td class="col-cat" style="white-space: nowrap;"><span style="background: var(--bg-base); padding: 2px 6px; border-radius: 4px; font-size: 11px;">${tx.category || '-'}</span></td>
                <td class="col-amount">
                    <span class="privacy-blur" style="color: ${amountColor}; font-weight: bold;">${formatCurrency(tx.amount)}</span>
                </td>
                <td class="col-recon" style="text-align: center;">
                    ${reconcileHTML}
                </td>
                <td class="col-depuis">${depuis}</td>
                <td class="col-vers">${vers}</td>
                <td class="col-recurrence">${recText}</td>
                <td class="col-slip">${tx.check_slip_number || '-'}</td>
                <td class="col-attachments">${attachHtml}</td>
                <td class="col-actions" style="display: flex; gap: 5px; flex-wrap: nowrap; justify-content: flex-end;">
                    <button class="btn btn-secondary" style="padding: 4px 8px; font-size: 11px;" onclick="window.TimelineView.edit(${tx.id})">✏️ Éditer</button>
                    <button class="btn btn-danger" style="padding: 4px 8px; font-size: 11px;" onclick="window.TimelineView.delete(${tx.id})">X</button>
                </td>
            </tr>
            `;
        };

        const html = [
            ...unreconciled.map(renderRow),
            ...reconciled.map((tx, idx) => {
                if (idx === 0) tx._isFirstReconciled = true;
                return renderRow(tx);
            })
        ].join('');

        tbody.innerHTML = html || `<tr><td colspan="13" style="text-align:center; padding: 20px; color: var(--text-muted)">Aucune opération pour ce mois.</td></tr>`;
        
        // Auto-scroll to junction and fix sticky headers
        setTimeout(() => {
            // Fix sticky table headers position below the sticky view header
            const header = document.getElementById('timelineHeader');
            const ths = document.querySelectorAll('.data-table th');
            if (header && ths.length) {
                // offsetHeight of header minus the top negative margin compensation
                const offset = header.offsetHeight - 32; 
                ths.forEach(th => th.style.top = offset + 'px');
            }
            
            if (autoScroll) {
                const firstReconciled = document.getElementById('first-reconciled');
                if (firstReconciled) {
                    const main = document.querySelector('.app-main');
                    if (main) {
                        main.scrollTo({
                            top: firstReconciled.offsetTop - (main.clientHeight / 2) + (firstReconciled.offsetHeight / 2),
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

    async toggleReconciliation(id) {
        try {
            await API.post(`/api/transactions/${id}/toggle_reconciliation`);
            await this.loadData();
            window.app.refreshSidebar();
        } catch (e) {
            console.error(e);
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
    },
    
    showAddRow() {
        if (window.FormView) window.FormView.open();
    }
};
