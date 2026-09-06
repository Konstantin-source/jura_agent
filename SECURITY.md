# Security Policy

Bitte keine Sicherheitslücken mit echten Dokumenten oder API-Schlüsseln in öffentlichen Issues melden. Reproduktionsdaten müssen anonymisiert sein.

Der MVP verarbeitet potenziell sensible Klausuren und Notizen. Produktionszugang ist deshalb auf genau zwei lokal angelegte Konten beschränkt; eine öffentliche Registrierung existiert nicht. Passwörter werden gehasht, Sitzungen serverseitig gespeichert und persönliche Abfragen nach Nutzer-ID getrennt.

Die lokale SQLite-Datenbank und Uploads liegen im persistenten Docker-Volume. Dieses Volume ist nicht anwendungsseitig verschlüsselt und muss durch Host-Verschlüsselung, restriktive Portainer-Rechte und verschlüsselte Backups geschützt werden. Details stehen in `docs/ARCHITECTURE.md` und `docs/OPERATIONS.md`.
