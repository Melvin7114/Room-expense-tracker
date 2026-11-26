# Room Expense Tracker (RoomFund)

A responsive, single-page room expense tracker built with HTML, CSS and vanilla JavaScript.

## Run locally
1. Extract the ZIP file.
2. Open the `room-expense-tracker` folder in VS Code.
3. Open `index.html` in a browser, or use the VS Code Live Server extension.
4. The app saves data in the browser's `localStorage`.

## Publish with GitHub Pages
1. Create a GitHub repository (for example, `room-expense-tracker`).
2. Upload `index.html`, `style.css`, `app.js` and `README.md` to the repository root.
3. Open the repository's **Settings → Pages**.
4. Under **Build and deployment**, choose **Deploy from a branch**.
5. Select branch **main** and folder **/(root)**, then click **Save**.
6. Wait for the Pages deployment and open the published URL shown there.

## Features
- Dashboard totals and recent transactions
- Add, edit and delete deposits/expenses
- Prevents expenses from exceeding available group balance
- Search and filter transactions
- Rename four room members and see member totals
- Daily, monthly, category and member charts
- Export/import JSON backup
- Reset demo data and clear transactions

## Important data note
This version uses browser `localStorage`. GitHub Pages only hosts the static website; it does not provide a shared database. Data entered on one person's browser will not automatically appear on another person's phone or computer. For shared live syncing, connect a backend such as Firebase or Supabase.
