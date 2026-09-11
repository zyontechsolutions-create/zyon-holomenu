export default function TermsPage() {
  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "60px 24px", fontFamily: "Georgia, serif", lineHeight: 1.65, color: "#1E1B16" }}>
      <p style={{ fontSize: 12, color: "#8C6428", letterSpacing: 1, textTransform: "uppercase", marginBottom: 6 }}>Zyon Tech Solutions</p>
      <h1 style={{ fontFamily: "'Playfair Display', serif", marginBottom: 4 }}>Terms of Service</h1>
      <p style={{ fontSize: 13, color: "#6b6455", marginBottom: 36 }}>Last updated: [DATE — fill in when you publish this]</p>

      <p style={{ fontSize: 13, background: "#f5f0e4", padding: 16, borderRadius: 8, marginBottom: 32 }}>
        This is a plain-language starting draft, not a substitute for a lawyer&apos;s review. Read the note at the
        end before relying on it for real customers.
      </p>

      <h2>1. Who this applies to</h2>
      <p>
        These terms are between Zyon Tech Solutions (&quot;we&quot;, &quot;us&quot;) and the restaurant or business
        (&quot;you&quot;, the &quot;Restaurant&quot;) using Zyon HoloMenu to create and manage a digital menu, take
        orders, and manage staff tools. By creating an account or using the panel, you agree to these terms.
      </p>

      <h2>2. What the service does</h2>
      <p>
        Zyon HoloMenu gives you a digital menu your customers can browse and order from by scanning a QR code, a
        staff panel to manage your menu and incoming orders, and related tools (waiter calls, dashboard, QR codes).
        Orders placed through the service are requests sent to your staff — we do not process payments on your
        behalf, and you remain responsible for collecting payment from customers however you already do.
      </p>

      <h2>3. Your account</h2>
      <p>
        You&apos;re responsible for keeping your login credentials secure and for all activity under your account.
        Tell us right away if you suspect unauthorized access.
      </p>

      <h2>4. Fees and billing</h2>
      <p>
        Pricing and billing are currently arranged directly between you and Zyon Tech Solutions outside this app.
        We may suspend or pause access to your panel if payment isn&apos;t received as agreed, after reasonable
        notice.
      </p>

      <h2>5. Your responsibilities</h2>
      <p>
        You&apos;re responsible for the accuracy of your menu, prices, and descriptions (including allergen and
        dietary information such as veg/non-veg tags), and for the food, service, and order fulfillment itself. We
        provide the software; running the restaurant is on you.
      </p>

      <h2>6. Acceptable use</h2>
      <p>
        Don&apos;t use the service for anything illegal, to upload content you don&apos;t have rights to, or to try
        to disrupt or gain unauthorized access to the platform or other restaurants&apos; data.
      </p>

      <h2>7. Your data</h2>
      <p>
        You own your menu, dish, and order data. We store and process it to provide the service, as described in
        our <a href="/privacy" style={{ color: "#8C6428" }}>Privacy Policy</a>. If you stop using the service, you
        can request an export or deletion of your data by contacting us.
      </p>

      <h2>8. Service availability</h2>
      <p>
        We aim to keep the service reliably available but don&apos;t guarantee uninterrupted uptime, especially
        during early development. We&apos;ll do our best to give notice of planned maintenance that could affect
        you.
      </p>

      <h2>9. Limitation of liability</h2>
      <p>
        The service is provided &quot;as is.&quot; To the extent permitted by law, Zyon Tech Solutions isn&apos;t
        liable for indirect losses (like lost revenue from downtime) beyond what you&apos;ve paid us in the
        preceding three months.
      </p>

      <h2>10. Ending the service</h2>
      <p>
        Either of us can end this arrangement at any time. We&apos;ll give you reasonable notice before removing
        access, except in cases of non-payment or misuse of the platform.
      </p>

      <h2>11. Changes to these terms</h2>
      <p>
        We may update these terms as the product evolves. We&apos;ll let you know of material changes.
      </p>

      <h2>12. Governing law</h2>
      <p>These terms are governed by the laws of India.</p>

      <h2>13. Contact</h2>
      <p>Questions about these terms: [YOUR CONTACT EMAIL — fill in]</p>

      <hr style={{ margin: "40px 0", border: "none", borderTop: "1px solid rgba(30,27,22,0.1)" }} />
      <p style={{ fontSize: 12, color: "#6b6455" }}>
        Note: this draft was written to match how Zyon HoloMenu actually works today — manual billing, no in-app
        payments, minimal customer data collection. If the product changes (in-app payments, customer accounts,
        automated billing), this document needs updating to match. Before relying on this for paying customers,
        have a lawyer review it against your specific situation and current Indian law.
      </p>
    </div>
  );
}
