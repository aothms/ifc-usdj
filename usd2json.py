import functools
import re
import sys
from lark import Lark, Transformer, v_args
import json

usda_grammar = r"""
    start: meta statement*

    statement: assignment
             | block

    assignment: "uniform"? type "[]"? NAME ("=" (value | REFERENCE))?

    block: DEFTYPE NAME STRING "{" statement* "}"
    type: NAME

    DEFTYPE: ("def"|"class"|"over")

    value: STRING
          | NUMBER
          | "true" -> true
          | "false" -> false
          | "[" [value ("," value)*] "]" -> array
          | "(" [value ("," value)*] ")" -> array

    NAME: /[A-Za-z_][A-Za-z_:\.\d]*/
    STRING: /".*?"/
    NUMBER: /-?\d+(\.\d+)?([eE][+-]?\d+)?/
    REFERENCE: /<[^>]+>/

    meta: "(" (STRING | (/[A-Za-z_]+/ "=" value))+ ")"

    %import common.WS
    %ignore WS
    %ignore "#" /.+/
"""

parser = Lark(usda_grammar, start='start', parser='earley')

class USDAtoJSON(Transformer):
    def start(self, items):
        return {
            'children': [d for d in items if len(d)]
        }
    
    def statement(self, items):
        return items[0]
    
    def assignment(self, items):
        try:
            key = items[1].value
        except:
            breakpoint()
        try:
            value = items[2]
        except:
            value = None
        return {key: value}
    
    def block(self, items):
        subs = list(items[3:])
        props = functools.reduce(dict.__or__, filter(lambda d: len(d) == 1, subs), {})
        if set(map(len, subs)) == {1}:
            subs = list(filter(lambda d: len(d) > 1, subs))
        return {
            "def": items[0].value,
            "type": items[1].value,
            "name": items[2],
            "children": subs,
            "attributes": props
        }
        
    def value(self, items):
        return items[0]
    
    def true(self, items):
        return True
    
    def false(self, items):
        return False
    
    def array(self, items):
        return items
    
    def meta(self, items):
        return {}

    @v_args(inline=True)
    def STRING(self, s):
        return s.strip('"')
    
    @v_args(inline=True)
    def NUMBER(self, n):
        return float(n) if '.' in n or 'e' in n or 'E' in n else int(n)

    @v_args(inline=True)
    def REFERENCE(self, r):
        return {
            'ref': r.value
        }

def parse_usda_to_dict(usda_content):
    parse_tree = parser.parse(usda_content)
    json_data = USDAtoJSON().transform(parse_tree)
    return json_data

usda_content = open(sys.argv[1]).read()

s = json.dumps(parse_usda_to_dict(usda_content), indent=1)
s = re.sub('\n\s+([\-\+\d\.e]+|\])(,?)(?=\n)', '\\1\\2', s)

with open(sys.argv[2], 'w') as f:
    print(s, file=f)
