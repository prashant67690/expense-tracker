# Khaata

Khaata turns bank SMS alerts into a personal expense ledger. Paste a debit message, or upload a text file of them, and it files the amount, bank, account, payee, date, and category. Everything stays in this browser.

A website cannot read the SMS inbox on your phone. Khaata is the ledger and the parser. A native Android app can feed it the same messages.

## Run it

```bash
npm install
npm run dev
```

Open [http://127.0.0.1:43123](http://127.0.0.1:43123) if you start the dev server with `-p 43123`. The default Next.js port is 3000.

```bash
npm test
```

## What a message becomes

A typical alert looks like this:

```text
HDFC Bank: Rs 1,250.00 debited from A/c **1234 on 02-10-26 to VPA swiggy@okhdfcbank. Avl Bal: Rs 45,230.12
```

Khaata keeps Rs 1,250.00 as the debit, HDFC Bank as the bank, 1234 as the account mask, Swiggy as the payee, and 2 Oct 2026 as the date. The available balance is not an expense. Messages that are one-time passwords are skipped.

Built-in keywords file Swiggy under Food, Uber under Transport, Netflix under Entertainment, and a salary credit under Income. Add your own rule when a payee should always land somewhere else.

## How to do this on a phone

Banks already send the event. The product decision is how the app hears it.

| Path | Works on | What you trade |
| --- | --- | --- |
| Paste, share, or upload the text | Android and iPhone | You confirm each batch. This app does that. |
| Notification access | Android | The app reads notifications from your bank apps. You grant notification access in system settings. |
| Read SMS | Android, personal or sideloaded apps | `READ_SMS` is a restricted Play permission. Google generally will not approve a store listing that asks for it just to track spending. |
| Email alerts | Both | Connect Gmail in the inbox, or paste a bank email. You still confirm each batch. |
| Account aggregator or open banking | Both, where a bank supports it | The regulated way to read real account history. In India that is the Account Aggregator network. |

iOS does not let third-party apps read SMS. Do not plan an iPhone version around the inbox.

If you still build a personal Android reader for your own phone:

1. Ask for `READ_SMS` only after explaining why, and offer paste as the fallback.
2. Query the inbox for recent messages, or listen for new ones.
3. Run the same parse step on the device. Drop anything that looks like an OTP before you store it.
4. Save amount, direction, bank, payee, category, and date. Do not upload the raw inbox.

Play-store expense apps that need a live feed usually use notification access, email, or a regulated bank connection instead of SMS permission.

## Bank mail

The inbox can read payment emails from Gmail. It uses read-only access, searches the last 30 days for bank senders, and shows each alert for you to file. Nothing is written to the ledger until you confirm it. Mail is loaded when you choose **Check bank mail**.

1. In Google Cloud, create an OAuth client of type **Web application** and enable the Gmail API.
2. Add your Google account as a test user on the consent screen.
3. Set the redirect URI to the site you actually open, plus `/api/gmail/callback`. For the default dev server that is `http://127.0.0.1:3000/api/gmail/callback`.
4. Copy `.env.example` to `.env.local` and fill in `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.
5. Restart `npm run dev`, open Inbox, and choose **Connect Gmail**.

Each person's refresh token is stored in Postgres and deleted when they disconnect.

## Privacy

The ledger is stored in `localStorage` under `khaata.ledger.v1`. Bank mail is fetched by this app’s server only after you connect Gmail, and only messages that match the bank search are returned for review. Clearing site data, or using **Clear ledger**, removes the transactions. Disconnect Gmail to drop the mail token.
