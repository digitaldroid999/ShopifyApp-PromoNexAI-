import { useEffect } from "react";
import type { LoaderFunctionArgs } from "react-router";
import { Form, useLoaderData } from "react-router";

import { login } from "../../shopify.server";

import styles from "./styles.module.css";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const shop = url.searchParams.get("shop");
  if (shop) {
    return {
      showForm: false,
      redirectToApp: true,
      searchParams: url.searchParams.toString(),
    };
  }
  return { showForm: Boolean(login), redirectToApp: false, searchParams: "" };
};

export default function App() {
  const { showForm, redirectToApp, searchParams } = useLoaderData<typeof loader>();

  useEffect(() => {
    if (redirectToApp && searchParams) {
      window.location.replace(`/app?${searchParams}`);
    }
  }, [redirectToApp, searchParams]);

  if (redirectToApp) {
    return (
      <div className={styles.index}>
        <div className={styles.content}>
          <p className={styles.text}>Redirecting to app…</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.index}>
      <div className={styles.content}>
        <h1 className={styles.heading}>A short heading about [your app]</h1>
        <p className={styles.text}>
          A tagline about [your app] that describes your value proposition.
        </p>
        {showForm && (
          <Form className={styles.form} method="post" action="/auth/login">
            <label className={styles.label}>
              <span>Shop domain</span>
              <input className={styles.input} type="text" name="shop" />
              <span>e.g: my-shop-domain.myshopify.com</span>
            </label>
            <button className={styles.button} type="submit">
              Log in
            </button>
          </Form>
        )}
        <ul className={styles.list}>
          <li>
            <strong>Product feature</strong>. Some detail about your feature and
            its benefit to your customer.
          </li>
          <li>
            <strong>Product feature</strong>. Some detail about your feature and
            its benefit to your customer.
          </li>
          <li>
            <strong>Product feature</strong>. Some detail about your feature and
            its benefit to your customer.
          </li>
        </ul>
      </div>
    </div>
  );
}
