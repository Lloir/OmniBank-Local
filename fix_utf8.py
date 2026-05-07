# -*- coding: utf-8 -*-
with open('static/js/views/budgets.js.corrupted', 'r', encoding='utf-8') as f:
    text = f.read()

replacements = {
    'Ã©': 'é',
    'Ã‰': 'É',
    'Ã¨': 'è',
    'Ã ': 'à',
    'Ã¢â‚¬”': '—',
    'ðŸŽ¯': '🎯',
    'ðŸ“Š': '📊',
    'ðŸ’¸': '💸',
    'â†‘': '↑',
    'âš ï¸ ': '⚠️',
    'â”€': '─',
    'Ãª': 'ê',
    'Ã§': 'ç',
    'Ã®': 'î',
    'Ã´': 'ô',
    'Ã»': 'û',
    'Ã¢': 'â',
    'Ã¯': 'ï',
    '\ufffd': '✨', 
    'âœ¨': '✨', 
    'âœ•': '✕', 
    'âž¡ï¸ ': '➡️'
}

for k, v in replacements.items():
    text = text.replace(k, v)

with open('static/js/views/budgets.js', 'w', encoding='utf-8-sig') as f:
    f.write(text)

print('Restored')
