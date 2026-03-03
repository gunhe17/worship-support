interface HomeHeaderTextProps {
  displayName: string;
}

export function HomeHeaderText({ displayName }: HomeHeaderTextProps) {
  return (
    <section className="mx-auto max-w-4xl px-2 text-center">
      <h1 className="text-4xl/10 font-semibold tracking-tight text-gray-900 dark:text-gray-100 sm:text-5xl/10">
        {displayName}님, 안녕하세요.
      </h1>
    </section>
  );
}
