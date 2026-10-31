import re, sys, pathlib
V=sys.argv[1]
root=pathlib.Path('.')
def bump(url):
    url=re.sub(r'\?v=[^"\')]*','',url)
    return url+'?v='+V
changed=[]
for f in list(root.glob('*.html')):
    s=f.read_text()
    def html_sub(m):
        attr,url=m.group(1),m.group(2)
        if url.startswith('http') or url.startswith('data:') or url.startswith('mailto:'): return m.group(0)
        if not (url.startswith('assets/') or url.startswith('/assets/') or url.startswith('src/') or url.startswith('/src/')): return m.group(0)
        return attr+'="'+bump(url)+'"'
    s2=re.sub(r'((?:href|src))="([^"]+)"',html_sub,s)
    if s2!=s: f.write_text(s2); changed.append(str(f))
for f in root.glob('src/**/*.js'):
    s=f.read_text()
    s2=re.sub(r"(from\s+['\"])(\.{1,2}/[^'\"]+?)(['\"])", lambda m: m.group(1)+bump(m.group(2))+m.group(3), s)
    s2=re.sub(r"(import\(\s*['\])(\.{1,2}/[^'\"]+?)(['\"]\s*\))", lambda m: m.group(1)+bump(m.group(2))+m.group(3), s2)
    s2=re.sub(r"(import\s+['\"])(\.{1,2}/[^'\"]+?)(['\"])", lambda m: m.group(1)+bump(m.group(2))+m.group(3), s2)
    if s2!=s: f.write_text(s2); changed.append(str(f))
for f in root.glob('assets/css/*.css'):
    s=f.read_text()
    s2=re.sub(r"url\((/assets/[^)]+?)\)", lambda m: 'url('+bump(m.group(1))+')', s)
    if s2!=s: f.write_text(s2); changed.append(str(f))
print('\n'.join(changed))
