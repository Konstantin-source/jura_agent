# Portainer und Cloudflare Tunnel

Der produktive Container lauscht ausschließlich innerhalb des externen Docker-Netzwerks `web-services` auf **Port 3000**. Es wird bewusst kein Host-Port veröffentlicht. Cloudflare Tunnel ist damit der einzige öffentliche Einstieg.

## 1. Netzwerk einmalig anlegen

In Portainer unter **Networks → Add network** ein Bridge-Netzwerk mit dem Namen `web-services` anlegen. Existiert es bereits, wird es unverändert wiederverwendet.

## 2. App-Stack aus Git bereitstellen

1. **Stacks → Add stack → Repository** öffnen.
2. Dieses Repository und den gewünschten Branch eintragen.
3. Als Compose-Pfad `docker-compose.portainer.yml` verwenden.
4. Die unten beschriebenen Stack-Variablen direkt in Portainer eintragen. Keine echte `.env`-Datei committen.
5. `DEMO_MODE=false` setzen und den Stack deployen.

Der interne Dienstname für Reverse Proxy oder Tunnel lautet:

```text
http://jura-agent:3000
```

Das Compose-Setup bindet das benannte Volume `jura-agent-data` unter `/data` ein. Dort liegen `jura-agent.db`, die SQLite-WAL-Dateien und der Ordner `uploads/`. App-Updates und Container-Neustarts erhalten diese Daten.

## 3. Portainer-Variablen

| Variable | Erforderlich | Beispiel / Zweck |
|---|---:|---|
| `DEMO_MODE` | ja | `false` für den Live-Betrieb |
| `OPENAI_API_KEY` | ja | geheimer OpenAI-API-Schlüssel |
| `APP_URL` | ja | öffentliche HTTPS-Adresse, z. B. `https://jura.example.com` |
| `SETUP_TOKEN` | nur erstmalig | mindestens 32 zufällige Zeichen; nach der Kontoeinrichtung entfernen |
| `OPENAI_PRIMARY_MODEL` | nein | Standard: `gpt-5.6-terra`; alternativ `gpt-5.6-luna` |
| `MONTHLY_AI_BUDGET_EUR` | nein | Standard: `10` |
| `EUR_PER_USD` | nein | Standard: `0.92` |
| `NEURIS_BASE_URL` | nein | Standard: amtliche NeuRIS-Testphasen-API |
| `LEGAL_SOURCE_CACHE_TTL_SECONDS` | nein | Standard: `86400` |
| `WEB_SERVICES_NETWORK` | nein | Standard: `web-services` |
| `JURA_AGENT_DATA_VOLUME` | nein | Standard: `jura-agent-data` |
| `CLOUDFLARE_TUNNEL_TOKEN` | nur im optionalen Tunnel-Stack | geheimer Tunnel-Token |

`DATA_DIR`, `NODE_ENV`, `HOSTNAME` und `PORT` sind bereits sicher im Compose-Stack gesetzt und müssen nicht manuell eingetragen werden. Ein Setup-Token lässt sich beispielsweise mit `openssl rand -hex 32` erzeugen.

## 4. Konten einmalig anlegen

1. Nach dem ersten gesunden Start `https://DEINE-DOMAIN/setup` öffnen.
2. Den `SETUP_TOKEN` und die Daten für genau zwei Konten eingeben. Jedes Passwort benötigt mindestens 12 Zeichen.
3. Mit beiden Konten testweise anmelden.
4. `SETUP_TOKEN` in Portainer löschen und den App-Stack erneut deployen.

Das Entfernen sperrt den Einrichtungs-Endpunkt zusätzlich ab. Konten und Sitzungen bleiben im Volume erhalten.

## 5. Cloudflare anbinden

### Bestehender Tunnel-Container

Den bestehenden `cloudflared`-Container zusätzlich mit `web-services` verbinden. Im Cloudflare Zero Trust Dashboard beim Public Hostname als Service `http://jura-agent:3000` eintragen. Das ist die bevorzugte Variante, weil nur ein Tunnel-Agent gepflegt werden muss.

### Eigener Tunnel für Jura Agent

Falls noch kein Tunnel läuft, einen remotely-managed Tunnel in Cloudflare anlegen, den Token als geheime Portainer-Variable `CLOUDFLARE_TUNNEL_TOKEN` hinterlegen und `docker-compose.cloudflare.yml` als zweiten Stack deployen. Den Token niemals committen. Das Image ist bewusst nicht auf eine veränderliche Version festgelegt; die eingesetzte Version sollte im Betrieb regelmäßig kontrolliert und bei Bedarf fest gepinnt werden.

## 6. DNS, TLS und Zugriff

Cloudflare beendet TLS am Edge. Für eine rein private Nutzung empfiehlt sich zusätzlich eine Cloudflare-Access-Regel, die nur eure beiden E-Mail-Adressen zulässt. Die lokale App-Authentifizierung bleibt trotzdem aktiv; beide Schichten erfüllen unterschiedliche Aufgaben. `APP_URL` muss mit `https://` beginnen, damit Cookies auch hinter dem Tunnel sicher behandelt werden.

## 7. Aktualisieren, prüfen und sichern

- In Portainer **Pull and redeploy** verwenden, wenn der Branch aktualisiert wurde.
- Container-Health muss `healthy` melden.
- `https://DEINE-DOMAIN/api/health` muss `status: ok` ausgeben, aber keine Geheimnisse.
- Der App-Container benötigt ausgehend HTTPS-Zugriff auf OpenAI und die amtlichen Rechtsportale.
- Vor einem Backup die App kurz stoppen oder eine SQLite-fähige Volume-Sicherung verwenden, damit Datenbank, WAL und Uploads konsistent zusammen gesichert werden.
- Wiederherstellungen zuerst auf einem Test-Volume prüfen. Die App unterstützt im MVP genau eine laufende Replik pro Daten-Volume.

## Hinweise

- `WEB_SERVICES_NETWORK` kann gesetzt werden, falls das vorhandene externe Netz anders heißt.
- Portainer muss das Image lokal aus dem Git-Kontext bauen können.
- Der Container läuft als unprivilegierter Nutzer, mit read-only Root-Dateisystem und ohne Linux-Capabilities.
- Das Volume ist nicht automatisch auf Anwendungsebene verschlüsselt. Für sensible Unterlagen ein verschlüsseltes Host-Dateisystem sowie verschlüsselte Backups verwenden.
- Das Volume niemals beim normalen Redeploy entfernen; sonst gehen Konten, Chats und Dokumente verloren.
