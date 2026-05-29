import './StoryCardSkeleton.css';

export default function StoryCardSkeleton() {
  return (
    <div className="skeleton-card card">
      {/* meta row */}
      <div className="skeleton-row">
        <span className="skeleton-line" style={{ width: '90px', height: '20px', borderRadius: '20px' }} />
        <span className="skeleton-line" style={{ width: '70px', height: '20px', borderRadius: '20px' }} />
        <span className="skeleton-line" style={{ width: '50px', height: '16px', marginLeft: 'auto' }} />
      </div>
      {/* title */}
      <div className="skeleton-line" style={{ width: '100%', height: '18px' }} />
      <div className="skeleton-line" style={{ width: '75%', height: '18px' }} />
      {/* summary */}
      <div className="skeleton-line" style={{ width: '100%', height: '14px' }} />
      <div className="skeleton-line" style={{ width: '90%', height: '14px' }} />
      <div className="skeleton-line" style={{ width: '60%', height: '14px' }} />
      {/* actions */}
      <div className="skeleton-row" style={{ marginTop: '4px' }}>
        <span className="skeleton-line" style={{ width: '76px', height: '34px', borderRadius: '8px' }} />
        <span className="skeleton-line" style={{ width: '96px', height: '34px', borderRadius: '8px' }} />
        <span className="skeleton-line" style={{ width: '76px', height: '34px', borderRadius: '8px' }} />
      </div>
    </div>
  );
}

export function SkeletonGrid({ count = 6 }) {
  return (
    <div className="stories-grid">
      {Array.from({ length: count }).map((_, i) => (
        <StoryCardSkeleton key={i} />
      ))}
    </div>
  );
}
