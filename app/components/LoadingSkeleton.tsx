export default function LoadingSkeleton() {
  return (
    <div className="w-full max-w-3xl mx-auto mt-8 space-y-5" aria-busy="true" aria-label="Analyzing ingredients…">
      {/* Score skeleton */}
      <div className="glass-card p-6 flex items-center gap-6">
        <div className="skeleton w-24 h-24 rounded-full flex-shrink-0" />
        <div className="flex-1 space-y-3">
          <div className="skeleton h-5 w-40 rounded" />
          <div className="skeleton h-3 w-full rounded" />
          <div className="skeleton h-3 w-5/6 rounded" />
        </div>
      </div>

      {/* Ingredient card skeletons */}
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="glass-card p-5 space-y-3"
          style={{ animationDelay: `${i * 0.08}s`, opacity: 1 - i * 0.1 }}
        >
          <div className="flex items-center justify-between">
            <div className="skeleton h-5 w-36 rounded" />
            <div className="skeleton h-6 w-20 rounded-full" />
          </div>
          <div className="skeleton h-3 w-full rounded" />
          <div className="skeleton h-3 w-4/5 rounded" />
        </div>
      ))}
    </div>
  );
}
