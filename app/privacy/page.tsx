export default function PrivacyPage() {
  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "60px 24px", fontFamily: "Georgia, serif", lineHeight: 1.65, color: "#1E1B16" }}>
      <p style={{ fontSize: 12, color: "#8C6428", letterSpacing: 1, textTransform: "uppercase", marginBottom: 6 }}>Zyon Tech Solutions</p>
      <h1 style={{ fontFamily: "'Playfair Display', serif", marginBottom: 4 }}>Privacy Policy</h1>
      <p style={{ fontSize: 13, color: "#6b6455", marginBottom: 36 }}>Last updated: [DATE — fill in when you publish this]</p>

      <p style={{ fontSize: 13, background: "#f5f0e4", padding: 16, borderRadius: 8, marginBottom: 32 }}>
        This is a plain-language starting draft, not a substitute for a lawyer&apos;s review. Read the note at the
        end before relying on it for real customers.
      </p>

      <h2>Who we are</h2>
      <p>
        Zyon Tech Solutions operates Zyon HoloMenu, a digital menu and ordering tool for restaurants. This policy
        explains what information we collect and how we use it — for both restaurant owners using the staff panel
        and customers browsing a menu.
      </p>

      <h2>If you&apos;re a customer browsing a menu</h2>
      <p>
        We don&apos;t require an account to browse a menu or place an order. We don&apos;t collect your name, phone
        number, or email address anywhere in the ordering flow. When you place an order, we store the items,
        quantities, total, and an optional note you choose to add (for example &quot;no onions&quot;) — please
        don&apos;t include personal information in that note field, as it&apos;s visible to restaurant staff and
        stored with the order.
      </p>
      <p>
        We log when a menu page is opened and which dishes are viewed, tied to the restaurant, not to you
        personally — this helps the restaurant understand what&apos;s popular. Your device stores a small, private
        list of your own past order IDs (using browser local storage) so the &quot;My Orders&quot; screen can show
        your order history to you — this stays on your device and isn&apos;t linked to your identity.
      </p>

      <h2>If you&apos;re a restaurant owner using the panel</h2>
      <p>
        To create an account, we collect your email address and the password you set (handled securely by our
        authentication provider, Supabase — we never see your password in plain text). We also store your
        restaurant&apos;s name, menu, categories, dish details, order history, and any plan/billing notes we keep
        for our own records.
      </p>

      <h2>How we use this information</h2>
      <p>
        To operate the service — displaying your menu, routing orders, showing your dashboard — and to communicate
        with you about your account. We don&apos;t sell data to third parties or use it for advertising.
      </p>

      <h2>Who else processes this data</h2>
      <p>We use a small number of service providers to run Zyon HoloMenu:</p>
      <ul>
        <li><strong>Supabase</strong> — our database, authentication, and file storage provider.</li>
        <li><strong>Vercel</strong> — hosts and serves the application.</li>
        <li><strong>Sentry</strong> — helps us catch and fix errors; this can incidentally capture technical details
          like your browser type and IP address at the moment of an error, never your order or account content.</li>
      </ul>
      <p>Each of these providers processes data on our behalf under their own security and privacy commitments.</p>

      <h2>How long we keep data</h2>
      <p>
        We keep account and order data for as long as your restaurant account is active, plus a reasonable period
        after for your own records. You can request deletion at any time — see Contact below.
      </p>

      <h2>Your rights</h2>
      <p>
        You can ask us what data we hold about you, request a copy of it, or ask us to delete it, by contacting us
        directly. For restaurant accounts, deleting your account will remove your menu and future order visibility,
        subject to any records we need to keep for legal or billing reasons.
      </p>

      <h2>Children</h2>
      <p>This service isn&apos;t directed at children, and we don&apos;t knowingly collect data from them.</p>

      <h2>Security</h2>
      <p>
        We rely on our providers&apos; security practices (encryption in transit, access controls) and restrict
        access to restaurant data so each restaurant can only see their own.
      </p>

      <h2>Changes to this policy</h2>
      <p>We may update this policy as the product changes. Material changes will be communicated to restaurant owners.</p>

      <h2>Contact</h2>
      <p>Questions or requests about your data — <a href="/support" style={{ color: "#8C6428" }}>raise a ticket</a> and we&apos;ll get back to you.</p>

      <hr style={{ margin: "40px 0", border: "none", borderTop: "1px solid rgba(30,27,22,0.1)" }} />
      <p style={{ fontSize: 12, color: "#6b6455" }}>
        Note: this draft reflects what Zyon HoloMenu actually collects today — no customer accounts, no in-app
        payments, minimal personal data. If you later add customer accounts, phone-based order tracking, loyalty
        programs, or in-app payments, this document needs real updates to match, since those would meaningfully
        change what personal data you handle. Before relying on this for paying customers, have a lawyer review it
        against your specific situation and current Indian law (including the Digital Personal Data Protection
        Act as its rules come into force).
      </p>
    </div>
  );
}
