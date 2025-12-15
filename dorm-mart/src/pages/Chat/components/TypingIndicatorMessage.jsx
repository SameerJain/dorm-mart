/**
 * Typing indicator message component (displays in messages area)
 */
export default function TypingIndicatorMessage({ firstName }) {
  const displayName = firstName || "Someone";
  
  return (
    <div className="flex justify-start">
      <div className="max-w-[80%] rounded-2xl px-3 py-2 bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-200 shadow">
        <div className="min-w-0">
          <span className="text-sm italic break-words whitespace-normal">{displayName} is typing...</span>
        </div>
      </div>
    </div>
  );
}



