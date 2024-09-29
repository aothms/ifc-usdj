import functools
import re
import sys
from lark import Lark, Transformer, v_args, Tree
import json

usda_grammar = r"""
    start: meta? statement*

    statement: assignment
             | block

    assignment: "prepend"? "custom"? "uniform"? type "[]"? NAME ("=" (value))?

    block: DEFTYPE NAME? STRING metadef? scope
    type: NAME

    metadef: "(" statement* ")"
    scope: "{" statement* "}"

    DEFTYPE: ("def"|"class"|"over")
    
    REFERENCE: /<[^>]+>/

    value: STRING
          | NUMBER
          | REFERENCE
          | "true" -> true
          | "false" -> false
          | "[" [value ("," value)*] ","? "]" -> array
          | "(" [value ("," value)*] ")" -> array

    NAME: /[A-Za-z_][A-Za-z_:\.\d]*/
    STRING: /".*?"/
    NUMBER: /-?\d+(\.\d+)?([eE][+-]?\d+)?/

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
        metadef = next((i for i in items if isinstance(i, Tree) and i.data == 'metadef'), None)
        scope = next((i for i in items if isinstance(i, Tree) and i.data == 'scope'), None)
        subs = [d for d in scope.children if len(d) > 1] if scope and scope.children else []
        props = functools.reduce(dict.__or__, [d for d in scope.children if len(d) == 1], {}) if scope and scope.children else []
        inherits = []
        if metadef and metadef.children:
            vs = next(iter(metadef.children[0].values()))
            if isinstance(vs, dict):
                vs = [vs]
            try:
                inherits = [next(iter(v.values())) for v in vs]
            except:
                # pray to the moon it's an APISchema
                pass
        return {
            # @nb lark.lexer.Token inherits from str
            "def": items[0].value,
            "type": None if type(items[1]) == str else items[1].value,
            "name": items[1] if type(items[1]) == str else items[2],
            **({"inherits": inherits} if inherits else {}),
            **({"attributes": props} if props else {}),
            **({"children": subs} if subs else {})
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
