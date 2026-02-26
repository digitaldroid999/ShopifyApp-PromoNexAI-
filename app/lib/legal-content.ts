/**
 * Shared legal document content for the LegalModal and legal pages.
 * Replace placeholder text with your actual Terms of Service, Privacy Policy, and DPA.
 */

export const LEGAL_DOCUMENTS = {
  terms: {
    title: "Terms of Service",
    content: `Last updated: [DATE]

1. Acceptance of Terms
By installing or using PromoNex AI ("App"), you agree to these Terms of Service. If you do not agree, do not use the App.

2. Description of Service
PromoNex AI provides AI-powered promotional video creation tools for Shopify merchants. We reserve the right to modify, suspend, or discontinue the Service at any time.

3. Your Responsibilities
You must use the App in compliance with applicable laws and Shopify's terms. You are responsible for content you create and publish. You may not use the App for illegal or abusive purposes.

4. Intellectual Property
You retain rights to your store content. We retain rights to the App, technology, and branding. By using the App you grant us limited rights to process your content as needed to provide the Service.

5. Fees and Payment
Fees (if any) are as described in the Shopify App listing or your plan. You authorize charges through your Shopify account.

6. Termination
You may uninstall the App at any time. We may suspend or terminate access for violation of these terms. Upon termination, your right to use the App ceases.

7. Disclaimers
THE APP IS PROVIDED "AS IS." WE DISCLAIM ALL WARRANTIES. WE ARE NOT LIABLE FOR INDIRECT, INCIDENTAL, OR CONSEQUENTIAL DAMAGES.

8. Limitation of Liability
OUR TOTAL LIABILITY SHALL NOT EXCEED THE AMOUNT YOU PAID US IN THE TWELVE MONTHS BEFORE THE CLAIM.

9. Changes
We may update these Terms. Continued use after changes constitutes acceptance. Material changes may require renewed consent.

10. Contact
Questions? Contact us at the support email provided in the App listing.`,
  },
  privacy: {
    title: "Privacy Policy",
    content: `Last updated: [DATE]

1. Who We Are
This Privacy Policy describes how PromoNex AI ("we") collects, uses, and shares information when you use our Shopify app.

2. Information We Collect
• Store and account information (e.g., shop domain, email) provided by Shopify
• Product data (images, titles, descriptions) you use within the App
• Usage data (e.g., feature usage, errors) to improve the Service
• Data you submit (e.g., scripts, preferences) when creating videos

3. How We Use Information
We use information to provide, operate, and improve the App; to process video generation; to communicate with you; and to comply with law.

4. Data Sharing
We do not sell your personal data. We may share data with service providers that assist us (e.g., hosting, AI providers), subject to confidentiality. We may disclose data if required by law.

5. Data Retention
We retain data as long as your store has the App installed and as needed for legal and operational purposes. You may request deletion by uninstalling and contacting us.

6. Security
We use reasonable measures to protect your data. No method of transmission or storage is 100% secure.

7. Your Rights
Depending on your location, you may have rights to access, correct, delete, or port your data. Contact us to exercise these rights.

8. Children
The App is not directed at children under 16. We do not knowingly collect data from children.

9. Changes
We may update this policy. We will notify you of material changes via the App or email.

10. Contact
For privacy questions or requests, contact us at the support email in the App listing.`,
  },
  dataProcessing: {
    title: "Data Processing Agreement (DPA)",
    content: `Last updated: [DATE]

1. Scope
This Data Processing Agreement ("DPA") applies when PromoNex AI processes Personal Data on your behalf as a merchant using our Shopify app, to the extent that we act as a processor and you act as a controller (or we are both processors under your instructions).

2. Definitions
• "Personal Data" means data relating to an identified or identifiable individual.
• "Processing" has the meaning given in applicable data protection law.
• "Controller" and "Processor" have the meanings given in the GDPR and equivalent laws.

3. Processing Details
• Subject matter: Provision of promotional video creation and related services.
• Duration: For the term of your use of the App and as needed thereafter for legal obligations.
• Nature and purpose: Processing necessary to provide the App (e.g., generating videos from product data, storing preferences).
• Types of data: Identifiers, product/content data, usage data, as described in our Privacy Policy.
• Data subjects: Your customers, your staff, and other individuals whose data you provide.

4. Your Instructions
We will process Personal Data only on your documented instructions (including via the App and this DPA), unless required by law.

5. Confidentiality and Security
We ensure that personnel authorized to process Personal Data are bound by confidentiality. We implement appropriate technical and organizational measures to protect Personal Data.

6. Sub-processors
We may engage sub-processors (e.g., cloud hosting, AI services). We will ensure they are bound by obligations consistent with this DPA. A list of key sub-processors is available on request.

7. Data Subject Rights
We will assist you in responding to data subject requests, to the extent we hold the relevant Personal Data and as required by law.

8. Audits and Assistance
We will make available information necessary to demonstrate compliance and will cooperate with audits to the extent required by applicable law.

9. Data Return and Deletion
Upon termination, we will delete or return Personal Data as agreed, except where we must retain it by law.

10. Liability
Liability under this DPA is subject to the limitations in our Terms of Service.`,
  },
} as const;
