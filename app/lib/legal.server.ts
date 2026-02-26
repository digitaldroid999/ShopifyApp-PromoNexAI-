/**
 * Legal agreement: terms version and server helpers.
 * Bump TERMS_VERSION when you update ToS, Privacy Policy, or DPA to re-prompt shops.
 */
import prisma from "../db.server";

/** Current version of legal documents. Increment when content changes to show modal again. */
export const TERMS_VERSION = "1.0";

export type LegalStatus = {
  agreed: boolean;
  currentTermsVersion: string;
  agreedVersion: string | null;
  isUpdatedTerms: boolean;
};

export async function getLegalStatus(shop: string): Promise<LegalStatus> {
  const agreement = await prisma.legalAgreement.findUnique({
    where: { shop },
  });
  const agreedVersion = agreement?.termsVersion ?? null;
  const agreed = agreement !== null && agreement.termsVersion === TERMS_VERSION;
  const isUpdatedTerms = agreement !== null && agreement.termsVersion !== TERMS_VERSION;
  return {
    agreed,
    currentTermsVersion: TERMS_VERSION,
    agreedVersion,
    isUpdatedTerms,
  };
}

export async function recordLegalAgreement(shop: string): Promise<void> {
  await prisma.legalAgreement.upsert({
    where: { shop },
    create: {
      shop,
      agreedAt: new Date(),
      termsVersion: TERMS_VERSION,
    },
    update: {
      agreedAt: new Date(),
      termsVersion: TERMS_VERSION,
    },
  });
}
