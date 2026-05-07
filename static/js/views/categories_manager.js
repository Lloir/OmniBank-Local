window.CategoriesView = {
    categories: [],
    
    render() {
        return `
            <div class="view-header" style="display:flex; justify-content:space-between; margin-bottom:15px;">
                <h2>🏷️ <span data-i18n="nav_categories">Catégories</span></h2>
            </div>
            
            <div style="margin-bottom: 20px; background: var(--bg-surface); padding: 15px; border-radius: 8px; border: 1px solid var(--border-color);">
                <h3>Nouvelle Catégorie</h3>
                <div style="display: flex; gap: 10px; margin-top: 10px;">
                    <input type="text" id="cat_name" class="inline-input" placeholder="Nom de la catégorie" style="border:1px solid var(--border-color); padding: 5px;">
                    <select id="cat_type" style="background: var(--bg-base); color: var(--text-main); border: 1px solid var(--border-color); padding: 5px;">
                        <option value="Dépenses fixes">Dépenses fixes</option>
                        <option value="Dépenses variables">Dépenses variables</option>
                        <option value="Recettes">Recettes</option>
                        <option value="Neutre">Neutre</option>
                    </select>
                    <button class="btn btn-secondary" onclick="window.CategoriesView.addCategory()">Ajouter</button>
                </div>
            </div>

            <div style="overflow-x: auto;">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Nom</th>
                            <th>Type de regroupement</th>
                            <th style="width: 50px;">Actions</th>
                        </tr>
                    </thead>
                    <tbody id="categoriesBody">
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
            this.categories = await API.get('/api/categories/');
            this.renderTable();
        } catch (e) {
            console.error("Failed to load categories", e);
        }
    },

    renderTable() {
        const tbody = document.getElementById('categoriesBody');
        if (!tbody) return;
        
        tbody.innerHTML = this.categories.map(cat => `
            <tr>
                <td>${cat.name}</td>
                <td>${cat.type}</td>
                <td>
                    <button class="btn btn-danger" style="padding: 2px 6px; font-size: 10px;" onclick="window.CategoriesView.delete(${cat.id})">X</button>
                </td>
            </tr>
        `).join('');
    },

    async addCategory() {
        try {
            const data = {
                name: document.getElementById('cat_name').value,
                type: document.getElementById('cat_type').value
            };
            if (!data.name) return await showInlineMessage("Info", "Nom requis");
            
            await API.post('/api/categories/', data);
            document.getElementById('cat_name').value = '';
            await this.loadData();
        } catch (e) {
            console.error(e);
            showInlineMessage("Info", "Erreur: Catégorie existante ou invalide");
        }
    },

    async delete(id) {
        if (await showInlineConfirm('Confirmation', 'Supprimer cette catégorie ?')) {
            try {
                await API.del(`/api/categories/${id}`);
                await this.loadData();
            } catch (e) {
                console.error(e);
            }
        }
    }
};
