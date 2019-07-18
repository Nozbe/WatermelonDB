#import "MelonModuleJSIInstaller.h"
#import "MelonModuleJSI.h"

// This shim is needed, because ObjC plays with C++ and Swift, but not both at the same time
extern "C" void installMelonModuleJSI(MelonModule *melonModule) {
    MelonModuleJSI::install(melonModule);
}
