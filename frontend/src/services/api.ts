export type WorkflowState = 'PLANNING' | 'PLAN_APPROVAL' | 'EXECUTION_REVIEW' | 'CODING' | 'COMPLETE';

export type Plan = {
  version: number;
  summary: string;
  tasks: string[];
  incorporated: string[];
  affectedAreas: string[];
  validation: string[];
};

export const api = {
  async getProject() { return { name: 'Weave', description: 'Collaborative agentic development workspace' }; },
  async getState(): Promise<WorkflowState> { return 'PLAN_APPROVAL'; },
  async getEvents() { return []; },
  async createRequest(text: string) { return { id: crypto.randomUUID(), text }; },
  async approvePlan() { return { state: 'EXECUTION_REVIEW' as WorkflowState }; },
  async sendBack(feedback: string) { return { state: 'PLANNING' as WorkflowState, feedback }; },
  async approveExecution() { return { state: 'CODING' as WorkflowState }; },
  async execute() { return { state: 'CODING' as WorkflowState }; },
};
