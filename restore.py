import codecs
with codecs.open('static/js/views/budgets.js.bak', 'r', 'utf-8') as f:
    text = f.read()

replacements = {
    'Ã©': 'é', 'Ã‰': 'É', 'Ã¨': 'è', 'Ã ': 'à', 'Ã¢â‚¬”': '—',
    'ðŸŽ¯': '🎯', 'ðŸ“Š': '📊', 'ðŸ’¸': '💸', 'â†‘': '↑', 'âš ï¸ ': '⚠️',
    'â”€': '─', 'Ãª': 'ê', 'Ã§': 'ç', 'Ã®': 'î', 'Ã´': 'ô', 'Ã»': 'û',
    'Ã¢': 'â', 'Ã¯': 'ï', '\ufffd': '✨', 'âœ¨': '✨', 'âœ•': '✕', 'âž¡ï¸ ': '➡️',
    'CLÔTUR': 'CLÔTURÉ', 'mise Ã\xa0 jour': 'mise à jour', 'Ã\xa0': 'à',
    'DÃ©penses': 'Dépenses', 'restants': 'restants', 'assignÃ©es': 'assignées',
    'Ã': 'à' # Be careful with this one, but most isolated Ã are à
}

for k, v in replacements.items():
    text = text.replace(k, v)

# Fix the 3 visual bugs!
text = text.replace('var(--color-expense)', '#ff5630')

with open('static/js/views/budgets.js', 'w', encoding='utf-8') as f:
    f.write(text)

print('Restored successfully')
