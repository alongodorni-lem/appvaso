# MVP Laboratorio AR con marcatore

Web app MVP per acquisire un disegno su foglio e applicarlo in AR su un vaso, ancorato al marker `hiro`.

## Avvio rapido

1. Apri la cartella progetto in Cursor.
2. Avvia un server statico (non usare `file://` perché la camera può non funzionare):
   - estensione VSCode/Cursor "Live Server", oppure
   - qualsiasi server HTTP locale.
3. Apri l'URL dal telefono (stessa rete locale) o direttamente sul browser mobile.
4. Consenti accesso camera.
5. Inquadra il marker `hiro`.
6. Premi `Acquisisci disegno`, poi `Scatta`.
7. Premi `Applica al vaso`.

## Pubblicazione su Render (consigliato per test clienti)

### 1) Prepara asset locale del vaso

1. Crea (o usa) la cartella `assets` nel progetto.
2. Copia l'immagine del vaso nel file:
   - `assets/vase-base.png`
3. Verifica locale su:
   - `http://localhost:8090/index.html`

### 2) Carica il progetto su GitHub

Da terminale nella root del progetto:

```powershell
git init
git add .
git commit -m "MVP WebAR marker-based"
git branch -M main
git remote add origin <URL_REPO_GITHUB>
git push -u origin main
```

### 3) Deploy Render Static Site

1. Vai su Render e fai login.
2. `New +` -> `Static Site`.
3. Collega il repository GitHub.
4. Impostazioni consigliate:
   - **Build Command**: lascia vuoto
   - **Publish Directory**: `.`
5. Clicca `Create Static Site`.
6. Apri il dominio assegnato (`https://...onrender.com`).

### 4) Test da smartphone

1. Apri l'URL Render dal telefono.
2. Consenti accesso camera.
3. Inquadra marker HIRO.
4. Esegui il flusso:
   - `Acquisisci disegno` -> `Scatta` -> `Applica al vaso` -> `Salva foto`.

## File principali

- `index.html`: UI, canvas e scena A-Frame/AR.js.
- `src/main.js`: orchestrazione flusso MVP.
- `src/capture/extract-drawing.js`: estrazione tratto/nome dal foglio.
- `src/compose/apply-on-vase.js`: composizione del disegno sulla fascia del vaso.

## Marker

Per MVP è usato il marker preset `hiro` di AR.js. È sufficiente stampare "AR.js hiro marker" e inquadrarlo in buona luce.

Link marker pronto:

- PNG: `https://raw.githubusercontent.com/AR-js-org/AR.js/master/data/images/hiro.png`
- PDF: `https://raw.githubusercontent.com/artoolkit/artoolkit5/master/doc/patterns/Hiro%20pattern.pdf`

## Note MVP

- La zona decorabile del vaso è una fascia ellittica approssimata.
- L'estrazione del disegno usa OpenCV.js con fallback JS semplice.
