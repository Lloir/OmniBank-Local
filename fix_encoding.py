import codecs

with codecs.open('static/js/views/budgets.js', 'r', encoding='cp1252', errors='replace') as f:
    content = f.read()

# Fix broken characters
content = content.replace('D\u01f8penses', 'D\u00e9penses')
content = content.replace('d\u01f8pens\u01f8s', 'd\u00e9pens\u00e9s')
content = content.replace('d\u01f8passement', 'd\u00e9passement')
content = content.replace('d\u01f8tail', 'd\u00e9tail')
content = content.replace('d\u01f8finie', 'd\u00e9finie')
content = content.replace('op\u01f8ration', 'op\u00e9ration')
content = content.replace('Op\u01f8rations', 'Op\u00e9rations')
content = content.replace('\u0178\'' + '\u0178', '\ud83d\udcb8')
content = content.replace('\u0178YZ\u0178', '\ud83c\udfaf')
content = content.replace('\u0178Y\"S', '\ud83d\udcca')
content = content.replace('\u0178o ', '\u2715')
content = content.replace('\u0178s\u0178? ', '\u26a0\ufe0f')
content = content.replace('\u0178\' ', '\u2191')
content = content.replace('\"?\u0178\"?', '\u2500\u2500')

with codecs.open('static/js/views/budgets.js', 'w', 'utf-8-sig') as f:
    f.write(content)

print('Fixed encoding')
