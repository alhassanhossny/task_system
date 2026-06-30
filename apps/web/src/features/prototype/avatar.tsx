export function Av({ letter, color, size = "md" }: { letter: string; color: string; size?: "sm" | "md" | "lg" }) {
  const s = { sm: "w-7 h-7 text-xs", md: "w-9 h-9 text-sm", lg: "w-12 h-12 text-base" }[size];
  return (
    <div className={`${s} ${color} rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0`}>
      {letter}
    </div>
  );
}
