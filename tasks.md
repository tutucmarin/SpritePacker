## To Do

## In Progress

## Done

- Export the atlas in the same format it was uploaded. For ex. if the atlas image was uploaded in webp or png format, export it correspondigly. <!-- task:eyJpZCI6ImU4ZTEzNDcwLTJiMzctNDc1Ny1iMDU4LWQyMDQ0OTI1YmE3NiIsImVtb2ppIjoi8J+TmCJ9 -->
- Handle duplicate names. If user adds a sprite with a existing title ask if they want to replace it. <!-- task:eyJpZCI6IjgyMTU2NjJkLWZmMGUtNDVjMS05NDllLWQ3OGVkN2FjMWRiMiIsImVtb2ppIjoi8J+TmCJ9 -->
- Before exporting lots of sprites, ask the user if they are sure about that, because they'll have to click a lot of times on save/cancel
- In Download section add a option to select the image export format. By default must be the uploaded type. So uploaded webp -> default export webp, uploaded .png -> def export .png
- If I keep the app open in background for awhile, it crashes with the following error:
  <--- Last few GCs --->

[2084:0xa19400000] 4219773 ms: Scavenge 15919.4 (16399.8) -> 15913.3 (16399.8) MB, 53.71 / 0.00 ms (average mu = 0.140, current mu = 0.086) task;
[2084:0xa19400000] 4219858 ms: Scavenge 15926.9 (16401.0) -> 15919.1 (16403.8) MB, 44.46 / 0.00 ms (average mu = 0.140, current mu = 0.086) allocation failure;
[2084:0xa19400000] 4219929 ms: Scavenge 15938.4 (16411.6) -> 15931.2 (16416.6) MB, 32.08 / 0.00 ms (average mu = 0.140, current mu = 0.086) allocation failure;

<--- JS stacktrace --->

FATAL ERROR: Ineffective mark-compacts near heap limit Allocation failed - JavaScript heap out of memory
----- Native stack trace -----

1: 0x100383f7c node::OOMErrorHandler(char const*, v8::OOMDetails const&) [/Users/marintutuc/.nvm/versions/node/v20.19.6/bin/node]
2: 0x100532bf8 v8::internal::V8::FatalProcessOutOfMemory(v8::internal::Isolate*, char const*, v8::OOMDetails const&) [/Users/marintutuc/.nvm/versions/node/v20.19.6/bin/node]
3: 0x100740a4c v8::internal::Heap::GarbageCollectionReasonToString(v8::internal::GarbageCollectionReason) [/Users/marintutuc/.nvm/versions/node/v20.19.6/bin/node]
4: 0x100744548 v8::internal::Heap::CollectGarbageShared(v8::internal::LocalHeap*, v8::internal::GarbageCollectionReason) [/Users/marintutuc/.nvm/versions/node/v20.19.6/bin/node]
5: 0x1007413c4 v8::internal::Heap::PerformGarbageCollection(v8::internal::GarbageCollector, v8::internal::GarbageCollectionReason, char const*) [/Users/marintutuc/.nvm/versions/node/v20.19.6/bin/node]
6: 0x10073ef40 v8::internal::Heap::CollectGarbage(v8::internal::AllocationSpace, v8::internal::GarbageCollectionReason, v8::GCCallbackFlags) [/Users/marintutuc/.nvm/versions/node/v20.19.6/bin/node]
7: 0x1007ac2fc v8::internal::MinorGCJob::Task::RunInternal() [/Users/marintutuc/.nvm/versions/node/v20.19.6/bin/node]
8: 0x1003f43fc node::PerIsolatePlatformData::RunForegroundTask(std::**1::unique_ptr<v8::Task, std::**1::default_delete<v8::Task>>) [/Users/marintutuc/.nvm/versions/node/v20.19.6/bin/node]
9: 0x1003f3450 node::PerIsolatePlatformData::FlushForegroundTasksInternal() [/Users/marintutuc/.nvm/versions/node/v20.19.6/bin/node]
10: 0x100e101e0 uv**async_io [/Users/marintutuc/.nvm/versions/node/v20.19.6/bin/node]
11: 0x100e22e88 uv**io_poll [/Users/marintutuc/.nvm/versions/node/v20.19.6/bin/node]
12: 0x100e10748 uv_run [/Users/marintutuc/.nvm/versions/node/v20.19.6/bin/node]
13: 0x1002997e8 node::SpinEventLoopInternal(node::Environment*) [/Users/marintutuc/.nvm/versions/node/v20.19.6/bin/node]
14: 0x1003c8954 node::NodeMainInstance::Run() [/Users/marintutuc/.nvm/versions/node/v20.19.6/bin/node]
15: 0x100345020 node::Start(int, char\*\*) [/Users/marintutuc/.nvm/versions/node/v20.19.6/bin/node]
16: 0x18630fe00 start [/usr/lib/dyld]
