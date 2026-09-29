// Author: Khadim Gueye

import HeroBackdrop from "../components/HeroBackdrop";
import { useSettings } from "../settings";

export const PRIVACY_UPDATED = "29 September 2026";

export default function PrivacyPage() {
  const { settings } = useSettings();
  const lab = settings?.["site.lab"] ?? "Ify Aniebo Lab";
  const institute = settings?.["site.institute"] ?? "Institute of Genomics and Global Health, Nigeria";
  const contact = settings?.["site.contact_email"];
  const website = settings?.["site.website_url"];

  return (
    <div className="page">
      <div className="page-hero compact">
        <HeroBackdrop />
        <div>
          <p className="eyebrow">Your data</p>
          <h1 className="page-title">
            Privacy <span>notice</span>
          </h1>
          <p className="page-lede">What this website records, why, and what you can ask us. Last updated {PRIVACY_UPDATED}.</p>
        </div>
      </div>

      <article className="panel privacy">
        <section>
          <h2>Who we are</h2>
          <p>
            This dashboard is run by the {lab}, {institute}, Redeemer's University, Ede, Nigeria. We handle personal data in line
            with the Nigeria Data Protection Act 2023.
          </p>
        </section>

        <section>
          <h2>When you visit the website</h2>
          <p>
            Visits are counted anonymously (page, device, approximate country and city) to see how the dashboard is used. We do not
            keep your IP address and use no advertising cookies.
          </p>
        </section>

        <section>
          <h2>When you download a report or data</h2>
          <p>
            Before a PDF report or a data file is downloaded we ask for your name, email and, if you wish, your organisation. We record
            them with what was downloaded, the date and an approximate place. This tells the lab who uses the evidence, for example
            health programmes, researchers or partners, and helps us report on the impact of the work. Your browser remembers your
            details so you do not have to type them again.
          </p>
        </section>

        <section>
          <h2>Who can see it</h2>
          <p>
            Only the IGH team members who manage the dashboard. We never sell your details, never share them with third parties and
            never use them for marketing. We may contact you about the report you downloaded.
          </p>
        </section>

        <section>
          <h2>How long we keep it</h2>
          <p>
            Download records are kept while they are useful to follow the use of the dashboard, and no longer than five years. Visit
            statistics do not identify you.
          </p>
        </section>

        <section>
          <h2>Your rights</h2>
          <p>
            You can ask to see, correct or delete the details we hold about you, or object to their use.{" "}
            {contact ? (
              <>
                Write to <a href={`mailto:${contact}`}>{contact}</a>.
              </>
            ) : website ? (
              <>
                Contact the lab through the{" "}
                <a href={website} target="_blank" rel="noreferrer">
                  institute website
                </a>
                .
              </>
            ) : (
              "Contact the lab."
            )}{" "}
            You can also clear the details remembered by your browser at any time by clearing this site's data in your browser settings.
          </p>
        </section>
      </article>
    </div>
  );
}
