import type { ReactNode } from "react";

export function MobileDrawer(props: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  if (!props.open) return null;
  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <div className="absolute inset-0 bg-black/30" onClick={props.onClose} />
      <div className="absolute left-0 top-0 h-full w-[86%] max-w-[360px] overflow-y-auto bg-white p-4 ring-1 ring-black/10">
        {props.children}
      </div>
    </div>
  );
}

