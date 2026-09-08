import type { SVGProps } from "react";

type Props = SVGProps<SVGSVGElement>;
const base = { width: 20, height: 20, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };

export function MoonIcon(props: Props) { return <svg {...base} {...props}><path d="M20 15.2A8.4 8.4 0 0 1 8.8 4a8.4 8.4 0 1 0 11.2 11.2Z" /></svg>; }
export function CloudIcon(props: Props) { return <svg {...base} {...props}><path d="M7 18h10.5a4.5 4.5 0 0 0 .4-9A6.5 6.5 0 0 0 5.6 8.2 5 5 0 0 0 7 18Z" /></svg>; }
export function RiverIcon(props: Props) { return <svg {...base} {...props}><path d="M4 5c4 0 4 2 8 2s4-2 8-2M4 11c4 0 4 2 8 2s4-2 8-2M4 17c4 0 4 2 8 2s4-2 8-2" /></svg>; }
export function PinIcon(props: Props) { return <svg {...base} {...props}><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></svg>; }
export function ClockIcon(props: Props) { return <svg {...base} {...props}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>; }
export function CheckIcon(props: Props) { return <svg {...base} {...props}><path d="m5 12 4 4L19 6" /></svg>; }
export function AlertIcon(props: Props) { return <svg {...base} {...props}><path d="M12 3 2.8 20h18.4L12 3Z" /><path d="M12 9v4M12 17h.01" /></svg>; }
export function ArrowIcon(props: Props) { return <svg {...base} {...props}><path d="M5 12h14M14 7l5 5-5 5" /></svg>; }
