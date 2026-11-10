import { Card, CardBody } from '@/components/ui/Card'

/** Temporary placeholder used only while the application is built phase by phase. */
export function ComingSoon({ name }: { name: string }) {
  return (
    <Card>
      <CardBody>
        <p className="font-semibold">{name}</p>
        <p className="text-sm text-muted">This page is built in a later phase.</p>
      </CardBody>
    </Card>
  )
}
