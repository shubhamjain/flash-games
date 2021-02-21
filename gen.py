import sh
import json
from jinja2 import Template

gamesL = Template(str(sh.cat("games.html")))
indexL = Template(str(sh.cat("index-layout.html")))

swfdata = json.loads(str(sh.cat("swf.json")))

for swf in swfdata:
    with open("games/%s.html" % (swf['permalink']), "w") as f:
        f.write(gamesL.render(**swf));

with open("index.html", "w") as f:
    f.write(indexL.render(links=swfdata))