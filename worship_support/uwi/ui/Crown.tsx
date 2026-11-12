export default function Crown({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
      <path d="M3 7.5 7.5 11 12 4.5 16.5 11 21 7.5 19 18H5z" />
    </svg>
  );
}
