interface AlertProps {
  message: string | null;
  variant: "error" | "success";
}

const styles = {
  error: "rounded-md bg-red-50 p-3 text-sm/6 text-red-600 ring-1 ring-red-200 dark:bg-gray-900 dark:text-gray-300 dark:ring-gray-700",
  success: "rounded-md bg-green-50 p-3 text-sm/6 text-green-600 ring-1 ring-green-200 dark:bg-gray-900 dark:text-gray-300 dark:ring-gray-700",
};

export function Alert({ message, variant }: AlertProps) {
  if (!message) return null;
  return <div className={styles[variant]}>{message}</div>;
}
