type BadgeColor = "gray" | "red" | "yellow" | "green" | "blue" | "indigo" | "purple" | "pink";

interface BadgeProps {
  color?: BadgeColor;
  children: React.ReactNode;
}

const colorStyles: Record<BadgeColor, string> = {
  gray: "bg-gray-400/10 text-gray-400 inset-ring-gray-400/20",
  red: "bg-red-400/10 text-red-400 inset-ring-red-400/20",
  yellow: "bg-yellow-400/10 text-yellow-500 inset-ring-yellow-400/20",
  green: "bg-green-400/10 text-green-400 inset-ring-green-500/20",
  blue: "bg-blue-400/10 text-blue-400 inset-ring-blue-400/30",
  indigo: "bg-indigo-400/10 text-indigo-400 inset-ring-indigo-400/30",
  purple: "bg-purple-400/10 text-purple-400 inset-ring-purple-400/30",
  pink: "bg-pink-400/10 text-pink-400 inset-ring-pink-400/20",
};

export function Badge({ color = "gray", children }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium inset-ring ${colorStyles[color]}`}
    >
      {children}
    </span>
  );
}
