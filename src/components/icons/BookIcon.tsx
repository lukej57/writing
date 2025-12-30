import { DarkMode, Gradient, LightMode } from '@/components/Icon'

export function BookIcon({
  id,
  color,
}: {
  id: string
  color?: React.ComponentProps<typeof Gradient>['color']
}) {
  return (
    <>
      <defs>
        <Gradient
          id={`${id}-gradient`}
          color={color}
          gradientTransform="matrix(0 21 -21 0 16 7)"
        />
        <Gradient
          id={`${id}-gradient-dark`}
          color={color}
          gradientTransform="matrix(0 24.5001 -19.2498 0 16 5.5)"
        />
      </defs>
      <LightMode>
        <circle cx={16} cy={16} r={12} fill={`url(#${id}-gradient)`} />
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M8 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2h-3.5a.5.5 0 0 0-.5.5v2a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1-.5-.5v-2a.5.5 0 0 0-.5-.5H10a2 2 0 0 1-2-2V6Z"
          className="fill-(--icon-background)"
          fillOpacity={0.5}
        />
        <path
          d="M10 5a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h2.5a1.5 1.5 0 0 1 1.5 1.5v2h2v-2a1.5 1.5 0 0 1 1.5-1.5H22a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1H10Zm-2 1a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2h-3.5a.5.5 0 0 0-.5.5v2a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1-.5-.5v-2a.5.5 0 0 0-.5-.5H10a2 2 0 0 1-2-2V6Z"
          className="fill-(--icon-foreground)"
        />
        <path
          d="M12 9a1 1 0 0 1 1-1h6a1 1 0 1 1 0 2h-6a1 1 0 0 1-1-1Zm0 4a1 1 0 0 1 1-1h6a1 1 0 1 1 0 2h-6a1 1 0 0 1-1-1Zm0 4a1 1 0 0 1 1-1h4a1 1 0 1 1 0 2h-4a1 1 0 0 1-1-1Z"
          className="fill-(--icon-foreground)"
        />
      </LightMode>
      <DarkMode>
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M8 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2h-3.5a.5.5 0 0 0-.5.5v2a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1-.5-.5v-2a.5.5 0 0 0-.5-.5H10a2 2 0 0 1-2-2V6Zm5 3a1 1 0 1 0 0 2h6a1 1 0 1 0 0-2h-6Zm-1 5a1 1 0 0 1 1-1h6a1 1 0 1 1 0 2h-6a1 1 0 0 1-1-1Zm1 3a1 1 0 1 0 0 2h4a1 1 0 1 0 0-2h-4Z"
          fill={`url(#${id}-gradient-dark)`}
        />
      </DarkMode>
    </>
  )
}
