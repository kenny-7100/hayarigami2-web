#!/usr/bin/env python3
"""Reproducible static analysis. pip install capstone==5.0.9 pyelftools==0.33.
Does not execute PSP code. Generated disassembly stays outside the Web build.
"""
import json
from pathlib import Path
import struct
from capstone import Cs, CS_ARCH_MIPS, CS_MODE_MIPS32, CS_MODE_LITTLE_ENDIAN
from elftools.elf.elffile import ELFFile

ROOT = Path(__file__).resolve().parents[1]

def main():
    path = ROOT / 'output/iso-inspection/PSP_GAME/SYSDIR/EBOOT.BIN'
    with path.open('rb') as stream:
        elf = ELFFile(stream)
        sections = list(elf.iter_sections())
        def read(address, count):
            for section in sections:
                start = section['sh_addr']
                if start <= address and address + count <= start + section['sh_size']:
                    return section.data()[address - start:address - start + count]
            raise ValueError(f'Unmapped ELF address {address:#x}')
        md = Cs(CS_ARCH_MIPS, CS_MODE_MIPS32 | CS_MODE_LITTLE_ENDIAN)
        md.skipdata = True  # Allegrex instructions not understood by Capstone remain explicit .byte.
        out = ROOT / 'output/reverse'
        out.mkdir(parents=True, exist_ok=True)
        with (out / 'eboot.asm').open('w') as target:
            for section in sections:
                if section['sh_flags'] & 4:
                    for instruction in md.disasm(section.data(), section['sh_addr']):
                        target.write(f'{instruction.address:08x}: {instruction.mnemonic:10} {instruction.op_str}\n')
        handlers = {}
        for group, pointer in struct.iter_unpack('<II', read(0x08882208, 20 * 8)):
            for i in range(100):
                opcode, function = struct.unpack('<II', read(pointer + i * 8, 8))
                if function == 0:
                    break
                assert opcode // 100 == group
                handlers[opcode] = f'0x{function:08X}'
        (out / 'opcode-handlers.json').write_text(json.dumps(handlers, indent=2) + '\n')
        print(f'{len(handlers)} opcode handlers; disassembly: {out}')

if __name__ == '__main__':
    main()
