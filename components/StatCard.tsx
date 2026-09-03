export default function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat-card-v2 fade-up">
      <div className="num">{value}</div>
      <div className="lbl">{label}</div>
    </div>
  );
}
