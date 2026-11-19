dictionary type FwPacketDescriptorType = U32
type FwSizeType = U32
dictionary type FwTlmPacketizeIdType = U16
dictionary type FwChanIdType = U32
dictionary type FwOpcodeType = U32
dictionary type FwEventIdType = U32
dictionary type FwPrmIdType = U32
dictionary type FwDpIdType = U32
dictionary type FwDpPriorityType = U32
dictionary type FwTimeBaseStoreType = U16
dictionary type FwTimeContextStoreType = U8
constant FW_FIXED_LENGTH_STRING_SIZE = 256
type FwSizeStoreType = U32
module Fw {
 enum DpState: U8 { UNTRANSMITTED, PARTIAL, TRANSMITTED } default UNTRANSMITTED
 module DpCfg { constant CONTAINER_USER_DATA_SIZE = 32
 enum ProcType: U8 { PROC_TYPE_NONE = 0, PROC_TYPE_ZLIB_DEFLATE = 1, PROC_TYPE_ONE = 2, PROC_TYPE_TWO = 4 } }
 type CmdArgBuffer
 type TlmBuffer
 type LogBuffer
 type TextLogString
 type ParamBuffer
 type Time
 enum CmdResponse : U8 { OK, VALIDATION_ERROR, EXECUTION_ERROR }
 enum ParamValid : U8 { UNINIT, VALID, INVALID, DEFAULT }
 enum LogSeverity : U8 { FATAL, WARNING_HI, WARNING_LO, COMMAND, ACTIVITY_HI, ACTIVITY_LO, DIAGNOSTIC }
 port CmdReg(opCode: U32)
 port Cmd(opCode: U32, cmdSeq: U32, ref args: CmdArgBuffer)
 port CmdResponse(opCode: U32, cmdSeq: U32, response: CmdResponse)
 port Time(ref $time: Time)
 port Log($id: U32, ref timeTag: Time, $severity: LogSeverity, ref args: LogBuffer)
 port LogText($id: U32, ref timeTag: Time, $severity: LogSeverity, ref $text: TextLogString)
 port Tlm($id: U32, ref timeTag: Time, ref val: TlmBuffer)
 port PrmGet($id: U32, ref val: ParamBuffer) -> ParamValid
 port PrmSet($id: U32, ref val: ParamBuffer)
}
