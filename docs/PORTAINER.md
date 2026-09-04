# Portainer und Cloudflare Tunnel

Der produktive Container lauscht ausschließlich innerhalb des externen Docker-Netzwerks `web-services` auf Port 3000. Es wird bewusst kein Host-Port veröffentlicht. Cloudflare Tunnel ist damit der einzige öffentliche Einstieg.

## 1. Netzwerk einmalig anlegen

In Portainer unter **Networks → Add network** ein Bridge-Netzwerk mit dem Namen `web-services` anlegen. Existiert es bereits, wird es unverändert wiederverwendet.

## 2. App-Stack aus Git bereitstellen

1. **Stacks → Add stack → Repository** öffnen.
2. Dieses Repository und den gewünschten Branch eintragen.
3. Als Compose-Pfad `docker-compose.portainer.yml` verwenden.
4. Die Stack-Variablen aus `.env.portainer.example` in Portainer eintragen.
5. `DEMO_MODE=false` setzen und den Stack deployen.

Der interne Dienstname für Reverse Proxy oder Tunnel lautet:

```text
http://jura-agent:3000
```

## 3. Cloudflare anbinden

### Bestehender Tunnel-Container

Den bestehenden `cloudflared`-Container zusätzlich mit `web-services` verbinden. Im Cloudflare Zero Trust Dashboard beim Public Hostname als Service `http://jura-agent:3000` eintragen. Das ist die bevorzugte Variante, weil nur ein Tunnel-Agent gepflegt werden muss.

### Eigener Tunnel für Jura Agent

Falls noch kein Tunnel läuft, einen remotely-managed Tunnel in Cloudflare anlegen, den Token als geheime Portainer-Variable `CLOUDFLARE_TUNNEL_TOKEN` hinterlegen und `docker-compose.cloudflare.yml` als zweiten Stack deployen. Den Token niemals committen.

## 4. DNS, TLS und Zugriff

Cloudflare beendet TLS am Edge. Für eine rein private Nutzung empfiehlt sich zusätzlich eine Cloudflare-Access-Regel, die nur eure beiden E-Mail-Adressen zulässt. Die App-Authentifizierung über Supabase bleibt trotzdem aktiv; beide Schichten erfüllen unterschiedliche Aufgaben.

## 5. Aktualisieren und prüfen

- In Portainer **Pull and redeploy** verwenden, wenn der Branch aktualisiert wurde.
- Container-Health muss `healthy` melden.
- `https://DEINE-DOMAIN/api/health` muss `status: ok` ausgeben, aber keine Geheimnisse.
- Der App-Container benötigt ausgehend HTTPS-Zugriff auf OpenAI, Supabase und die amtlichen Rechtsportale.

## Hinweise

- `WEB_SERVICES_NETWORK` kann gesetzt werden, falls das vorhandene externe Netz anders heißt.
- Portainer muss das Image lokal aus dem Git-Kontext bauen können.
- Der Container läuft als unprivilegierter Nutzer, mit read-only Root-Dateisystem und ohne Linux-Capabilities.
- Für Backups sind Supabase-Datenbank und der private Bucket maßgeblich; der App-Container selbst ist zustandslos.
