import Image from "next/image";
import { PersonIcon } from "@radix-ui/react-icons";

type AvatarSize = "xs" | "sm" | "md" | "lg";

interface AvatarProps {
  src?: string | null;
  alt?: string;
  size?: AvatarSize;
}

const sizeStyles: Record<AvatarSize, string> = {
  xs: "size-5",
  sm: "size-8",
  md: "size-10",
  lg: "size-12",
};

const fallbackSizeStyles: Record<AvatarSize, string> = {
  xs: "size-5",
  sm: "size-8",
  md: "size-10",
  lg: "size-12",
};

const sizePixels: Record<AvatarSize, number> = {
  xs: 20,
  sm: 32,
  md: 40,
  lg: 48,
};

export function Avatar({ src, alt = "", size = "md" }: AvatarProps) {
  if (src) {
    return (
      <Image
        src={src}
        alt={alt}
        width={sizePixels[size]}
        height={sizePixels[size]}
        unoptimized
        className={`${sizeStyles[size]} shrink-0 rounded-full bg-gray-200 outline-1 -outline-offset-1 outline-black/10 dark:bg-gray-700 dark:outline-gray-700`}
      />
    );
  }

  return (
    <PersonIcon
      aria-hidden="true"
      className={`${fallbackSizeStyles[size]} shrink-0 text-gray-300 dark:text-gray-500`}
    />
  );
}
