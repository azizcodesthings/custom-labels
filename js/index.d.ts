export type LabelValue = string | boolean | number | null | undefined;
type Labels = Record<string, string>;
type WithLabels = <T>(f: () => T, ...kvs: LabelValue[]) => T;
type CurLabels = () => Labels | undefined;
declare let withLabels: WithLabels;
declare let curLabels: CurLabels;
export { withLabels, curLabels };
