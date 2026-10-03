import type { Metadata } from "next";
import { LegalPage, LegalSection } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Privacy policy · Khaata",
  description:
    "How Khaata handles bank messages, Gmail access, and the ledger stored on your device.",
};

export default function PrivacyPolicyPage() {
  return (
    <LegalPage title="Privacy policy">
      <LegalSection title="Who this policy is for">
        <p>
          This policy describes Khaata, a personal expense ledger. It applies to
          the copy of the app you are using. Khaata is operated by the person
          who runs that copy. There is no separate Khaata account, and there is
          no Khaata cloud that stores your ledger.
        </p>
      </LegalSection>

      <LegalSection title="What the ledger holds">
        <p>
          When you file a transaction, this browser saves it in local storage
          under the key <span className="text-ink">khaata.ledger.v1</span>. A
          saved line can include the amount, currency, whether it is a debit or
          a credit, bank name, masked account number, payee, date, available
          balance if one was read, a reference number, category, a note you
          type, the original message text, the source (SMS, email, or manual),
          the time you saved it, and, for email, the Gmail message id. Category
          rules you add, such as a keyword and a category, are stored in the
          same place.
        </p>
        <p>
          That ledger stays in this browser. Khaata does not upload it to a
          server of its own. Clearing site data for this site removes it.{" "}
          <span className="text-ink">Clear ledger</span> removes the
          transactions and leaves your category rules in place. You can download
          a CSV of the filed lines. The CSV includes date, direction, amount,
          currency, bank, account mask, payee, category, and note. It does not
          include the original message text.
        </p>
      </LegalSection>

      <LegalSection title="Messages you paste or upload">
        <p>
          You can paste bank SMS text, load a sample, or upload a plain text
          file. That text is read in this browser so you can review each line
          before you file it. A message that looks like a one-time password is
          skipped and is not filed. The text you type sits in the page until you
          leave it or replace it. It is saved with a transaction only if you
          choose to file that line.
        </p>
      </LegalSection>

      <LegalSection title="Gmail">
        <p>
          If you choose Connect Gmail, Google asks you to sign in and to allow
          read-only access. The permission requested is{" "}
          <span className="text-ink">gmail.readonly</span>. Khaata can read
          mail. It cannot send, delete, or change mail.
        </p>
        <p>
          Mail is read only when you click Check bank mail. Khaata asks Gmail
          for messages from the last 30 days that come from bank sender domains
          and that look like payments, including words such as debited,
          credited, spent, salary, added, UPI, or txn. Subjects that look like
          one-time passwords are left out of that search. Each matching message
          is then fetched in full so the amount, bank, payee, and date can be
          read. HTML mail is turned into text on the computer that is running
          Khaata.
        </p>
        <p>
          You see a slip for each new payment and you choose what to file. A
          payment that is already in the ledger, matched by Gmail id, the same
          message text, or the same amount, date, debit or credit, and account,
          is not shown again. Mail that cannot be read as a payment can still
          appear as not filed, so you can see that it was skipped.
        </p>
        <p>
          Google receives the sign-in, the permission grant, and the mail
          requests. Google’s own privacy policy covers that part of the
          exchange. Khaata does not receive your Google password.
        </p>
      </LegalSection>

      <LegalSection title="Where the Gmail token is kept">
        <p>
          After you connect, Google returns an access token and a refresh token.
          Khaata stores those tokens in its database, in a row that belongs to
          your Google account. A session cookie in this browser tells the server
          which row is yours. Someone else’s cookie cannot read your row. The
          tokens are not encrypted by the app before they are saved. The
          database host can read them. The Google client id and client secret
          stay in the server environment.
        </p>
        <p>
          Disconnect deletes your token row and asks Google to revoke that
          token. Your ledger in this browser stays. If Google still lists the
          app under your account permissions, remove it there as well.
        </p>
        <p>
          Mail is fetched only for the signed-in account. The person who
          operates this database can still read the stored tokens and the
          messages fetched during a check.
        </p>
      </LegalSection>

      <LegalSection title="What Khaata does not do">
        <p>
          Khaata does not sell personal information, does not show ads, and does
          not run a third-party analytics tracker. It does not ask banks for
          your password. It does not read your whole mailbox on a schedule. It
          does not file a transaction until you confirm it.
        </p>
      </LegalSection>

      <LegalSection title="Children">
        <p>
          Khaata is not directed at children, and it should not be used to file
          a child’s financial information.
        </p>
      </LegalSection>

      <LegalSection title="Changes">
        <p>
          If this copy of the app starts handling information differently, this
          page should be updated and the effective date changed. The date at the
          top is the date of this text.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
