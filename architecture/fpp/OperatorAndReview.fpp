module MISSYR2 {
 passive component OperatorContract {
  command recv port cmdIn
  command reg port cmdReg
  command resp port cmdResp
  time get port timeGet
  event port eventOut
  text event port textEventOut
  telemetry port telemetryOut
  param get port paramGet
  param set port paramSet
  sync input port callIn: [256] Invocation
  output port callOut: [256] Invocation
  sync command SUBMIT_OPTION(optionNumber: U32) opcode 0x10
  sync command GENERATE_RUNS(profileDigest: string size 64) opcode 0x11
  sync command OPEN_MISSY opcode 0x12
  sync command STATUS opcode 0x13
  sync command LOAD_RDMLT(packageDigest: string size 64) opcode 0x14
  sync command APPLY_SOP(procedureId: string size 64) opcode 0x15
  sync command SHOW_RESULTS opcode 0x16
  sync command SHOW_CONTROL_PANEL opcode 0x17
  sync command SHOW_CURVES opcode 0x18
  telemetry CommandCount: U32 id 0x20
  telemetry FailureCount: U32 id 0x21
  telemetry LastDurationMs: F64 id 0x22
  telemetry LoadedRuns: U32 id 0x23
  telemetry ResultRows: U32 id 0x24
  telemetry ChartCount: U32 id 0x25
  event Started(commandCode: U32) severity activity low id 0x30 format "Command {} started"
  event Completed(commandCode: U32) severity activity low id 0x31 format "Command {} completed"
  event Failed(commandCode: U32) severity warning low id 0x32 format "Command {} failed"
  param SessionMinutes: U32 default 10 id 0x40
 }
 instance operator: OperatorContract base id 0x70000000
 deployment topology OperatorAndReview {
  instance operator
  instance c0080
  instance c0058
  instance c0050
  instance c0027
  instance c0020
  instance c0042
  instance c0059
  instance c0086
  connections Workflow {
   c0080.callOut[0] -> c0058.callIn[0]
   c0058.callOut[1] -> c0050.callIn[1]
   c0050.callOut[2] -> c0027.callIn[2]
   c0027.callOut[3] -> c0020.callIn[3]
   c0020.callOut[4] -> c0042.callIn[4]
   c0042.callOut[5] -> c0059.callIn[5]
   c0059.callOut[6] -> c0086.callIn[6]
   operator.callOut[0] -> c0080.callIn[20]
  }
 }
 system BrowserOperator: OperatorAndReview
}
