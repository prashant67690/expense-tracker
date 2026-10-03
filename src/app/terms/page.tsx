import type { Metadata } from "next";
import { LegalPage, LegalSection } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Terms of service · Khaata",
  description: "The terms for using Khaata to file bank alerts into a personal ledger.",
};

export default function TermsPage() {
  return (
    <LegalPage title="Terms of service">
      <LegalSection title="Agreement">
        <p>
          These terms govern your use of Khaata, the personal expense ledger at this site. By opening the
          app, pasting a message, uploading a file, connecting Gmail, or filing a transaction, you agree
          to these terms and to the privacy policy. If you do not agree, do not use the app and do not
          connect a mailbox.
        </p>
      </LegalSection>

      <LegalSection title="The service">
        <p>
          Khaata reads bank alert text that you provide, or bank mail that you ask it to fetch, and turns
          that text into a draft transaction. You review the draft and decide whether to file it. The
          filed ledger is stored in your browser. Category rules, a manual entry form, and a CSV download
          are part of the same ledger.
        </p>
        <p>
          Khaata is a record-keeping tool. It is not a bank, a card issuer, an accountant, or a financial
          adviser. It does not move money, open accounts, or submit anything to a bank. Figures in the
          ledger are not an official statement.
        </p>
      </LegalSection>

      <LegalSection title="Your responsibility for the messages">
        <p>
          You may paste or upload only messages you are allowed to use. If you connect Gmail, you must
          connect a mailbox you are allowed to read, and you must be the Google account holder who grants
          that access, or you must have that person’s permission. You are responsible for the mailbox you
          connect and for the transactions you file.
        </p>
        <p>
          Check bank mail runs only when you click it. You should read each slip before you file it. The
          parser can miss an amount, misread a payee, treat a balance as a payment, or skip a message that
          does not look like a debit or a credit. You are responsible for correcting a line before it is
          saved, and for deleting a line that is wrong.
        </p>
      </LegalSection>

      <LegalSection title="Gmail access">
        <p>
          Connect Gmail uses Google’s OAuth screen and requests read-only Gmail access. Your use of Google
          is also covered by Google’s terms and policies. Khaata uses that access to search recent bank
          payment mail and to fetch the messages you asked it to check. It does not send mail on your
          behalf.
        </p>
        <p>
          Disconnect removes the token stored by this copy of the app. It does not, by itself, remove the
          app from your Google Account. You may revoke that permission in your Google Account at any time.
        </p>
      </LegalSection>

      <LegalSection title="Acceptable use">
        <p>
          You may use Khaata for your own records. You may not use it to break the law, to read a mailbox
          you are not allowed to read, to bypass Google’s controls, or to interfere with the app. You may
          not present Khaata’s output as an official bank statement.
        </p>
      </LegalSection>

      <LegalSection title="Your data">
        <p>
          The ledger in this browser is yours to export, edit, and delete. Clear ledger removes filed
          transactions from this browser and leaves category rules in place. Clearing the site’s stored
          data removes the ledger, including the rules. Details of what is stored, and where the Gmail
          token is kept, are in the privacy policy.
        </p>
      </LegalSection>

      <LegalSection title="Availability">
        <p>
          This copy of Khaata may be a program running on your own computer. It can be stopped, updated, or
          removed by the person who runs it. Features can change. A Gmail check can fail if Google
          declines the request, if the token is missing, or if the app is not configured with a Google
          client id and secret.
        </p>
      </LegalSection>

      <LegalSection title="Disclaimer">
        <p>
          Khaata is provided as is and as available. To the fullest extent the law allows, the person who
          runs this copy disclaims warranties of accuracy, fitness for a particular purpose, and
          uninterrupted operation. You use the ledger and the mail reader at your own risk.
        </p>
      </LegalSection>

      <LegalSection title="Limitation of liability">
        <p>
          To the fullest extent the law allows, the person who runs this copy of Khaata is not liable for
          lost money, a missed payment, a wrong category, a parsing error, unauthorized access to the
          computer where the app is running, or loss of the ledger if you clear site data or lose the
          browser profile. Nothing in these terms limits liability that the law does not allow to be
          limited.
        </p>
      </LegalSection>

      <LegalSection title="Changes">
        <p>
          These terms may be updated by changing this page and its effective date. If you continue to use
          the app after the date changes, the updated terms apply to that later use.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
