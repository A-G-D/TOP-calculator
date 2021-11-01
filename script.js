const OP_ADD = '+';
const OP_SUB = '-';
const OP_MUL = '*';
const OP_DIV = '/';
const OP_POW = '^';
const OP_MOD = '%';
const OP_EXP = 'E';

const EXPRGROUP_IDENTITY = '1';

const EXPRGROUP_BEGIN = '(';
const EXPRGROUP_END = ')';


function isNull(o) {
    return o === null || o === undefined;
}

function isNumber(s) {
    return Number.isFinite(parseFloat(s, 10));
}

function arrToStr(a, quoteStrings = true) {
    if (Array.isArray(a)) {
        let s = '[';
        for (let i = 0; i < a.length; ++i) {
            s += arrToStr(a[i]);
            if (i + 1 < a.length)
                s += ', ';
        }
        return s + ']';
    }
    return ((typeof a) === 'string' && quoteStrings)? `'${a}'` : a.toString();
}


class ExpressionTree {
    #left;
    #right;
    #data;

    constructor(data, left = undefined, right = undefined) {
        if ((Array.isArray(data)) && left === undefined && right === undefined) {
            const n = data.length;
            if (n == 1) {
                this.#data = data[0];
            } else {
                this.#data = data[1];
                this.#left = new ExpressionTree(data[0]);
                this.#right = new ExpressionTree(data[2]);
            }
        } else {
            this.#data = data;
            this.#left = left;
            this.#right = right;
        }
    }

    get left() {
        return this.#left;
    }
    get right() {
        return this.#right;
    }
    get data() {
        return this.#data;
    }

    traversePostorder(onTraverse) {
        const left = isNull(this.left)? undefined : this.left.traversePostorder(onTraverse);
        const right = isNull(this.right)? undefined : this.right.traversePostorder(onTraverse);

        return onTraverse(this.data, left, right);
    }

    toString(indent = '') {
        let s = `${indent}${this.data}`;

        if (isNull(this.left) && isNull(this.right)) return s;

        let newIndent = indent + '\t';
        s += '\n';
        s += indent + '{\n';
        if (isNull(this.left))
            s += newIndent + 'NULL,\n';
        else
            s += this.left.toString(newIndent) + ',\n';
        if (isNull(this.right))
            s += newIndent + 'NULL\n';
        else
            s += this.right.toString(newIndent) + '\n';
        s += indent + '}';

        return s;
    }
}


class ExpressionParser {
    #operators;
    #opDictionary;

    #parseGroups(expressionString) {
        const groups = [];
        let segment = '';
        let level = 0;

        for (let i = 0; i < expressionString.length; ++i) {
            const c = expressionString[i];

            switch (c) {
                case EXPRGROUP_BEGIN:
                    if (level === 0) {
                        if (segment.length > 0) {
                            if (isNumber(segment[segment.length - 1]))
                                segment += OP_MUL;
                            groups.push(segment);
                            segment = '';
                        }
                    }
                    ++level;
                    break;
    
                case EXPRGROUP_END:
                    --level;
                    if (level === 0) {
                        if (segment.length === 0)
                            segment = EXPRGROUP_IDENTITY;
                        groups.push(this.#parseGroups(segment));
                        segment = '';
                        if ((i + 1 < expressionString.length) &&
                                !this.isOperatorSymbol(expressionString[i + 1])) {
                            segment = OP_MUL;
                        }
                    }
                    break;
    
                default:
                    segment += c;
            }
        }

        if (segment.length > 0)
            groups.push(segment);

        return groups;
    }

    static #parseNodes(expressionNodes, allowAsUnary, ...operators) {
        const nodes = [];

        for (let i = 0; i < expressionNodes.length; ++i) {
            const node = expressionNodes[i];
            let segment = '';

            if ((typeof node) === 'string') {
                for (let j = 0; j < node.length; ++j) {
                    const c = node[j];

                    if (operators.some(value => value === c)) {
                        if (segment.length > 0 || nodes.length > 0) {
                            if (segment.length > 0)
                                nodes.push([segment]);
                            nodes.push(c);

                            const rightExpr = [];
                            if (j + 1 < node.length)
                                rightExpr.push(node.substr(j + 1));
                            if (i + 1 < expressionNodes.length) {
                                const slice = expressionNodes.slice(i + 1)
                                if (slice.length == 1)
                                    rightExpr.push(...slice[0]);
                                else
                                    rightExpr.push(...slice);
                            }

                            nodes.push(ExpressionParser.#parseNodes(rightExpr, allowAsUnary, ...operators));

                            return nodes;

                        } else if (allowAsUnary) {
                            segment += c;
                        }

                    } else {
                        segment += c;
                    }
                }

                if (segment.length > 0)
                    nodes.push(segment);

            } else {
                nodes.push(ExpressionParser.#parseNodes(node, allowAsUnary, ...operators));
            }
        }

        return nodes;
    }

    constructor() {
        this.#operators = [];
        this.#opDictionary = {};
    }

    get operators() {
        return this.#operators;
    }

    addOperator(op, procedure, allowAsUnary = false, priority = 0) {
        let operator = {
            symbol: op,
            procedure: procedure,
            unaryFlag: allowAsUnary,
            priority: priority,
        };

        let i = this.#operators.length - 1;
        for (; i >= 0; --i) {
            if (priority <= this.#operators[i].priority)
                break;
        }

        if (i + 1 < this.#operators.length)
            this.#operators.splice(i + 1, 0, operator);
        else
            this.#operators.push(operator);
        this.#opDictionary[op] = operator;
    }

    isOperatorSymbol(c) {
        return this.#operators.some(item => item.symbol === c);
    }

    getOperator(symbol) {
        return this.#opDictionary[symbol];
    }

    // Will not parse ill-formed expressions
    parseExpression(expressionString) {
        expressionString = expressionString.replace(/\s+/g, '');

        let exprNodes = this.#parseGroups(expressionString);

        for (let i = this.#operators.length - 1; i >= 0; --i) {
            const operator = this.#operators[i];
            exprNodes = ExpressionParser.#parseNodes(
                exprNodes,
                operator.unaryFlag,
                operator.symbol
            );
        }

        return new ExpressionTree(exprNodes);
    }

    operate(operator, leftOperand, rightOperand) {
        if (isNumber(operator))
            return parseFloat(operator, 10);

        return this.getOperator(operator).procedure(leftOperand, rightOperand);
    }

    evaluate(expression) {
        const expressionTree = expressionParser.parseExpression(expression);
        return expressionTree.traversePostorder(expressionParser.operate.bind(expressionParser));
    }
}


// 

function isCharValid(c) {
    return (
        c.length === 1 && (
            /[0-9.πΦe()\s]/.exec(c) !== null ||
            expressionParser.operators.some(op => op.symbol === c)
        )
    );
}

function createExpressionParser() {
    const parser = new ExpressionParser();

    parser.addOperator(OP_ADD, (left, right) => left + right, true, 0);
    parser.addOperator(OP_SUB, (left, right) => left - right, true, 0);
    parser.addOperator(OP_MUL, (left, right) => left*right, false, 1);
    parser.addOperator(OP_DIV, (left, right) => left/right, false, 1);
    parser.addOperator(OP_POW, (left, right) => Math.pow(left, right), false, 2);
    parser.addOperator(OP_MOD, (left, right) => left%right, false, 2);
    parser.addOperator(OP_EXP, (left, right) => left*Math.pow(10, right), false, 3);

    return parser;
}


// 

const expressionParser = createExpressionParser();

const expressionTextArea = document.querySelector('.expression textarea');
const outputTextArea = document.querySelector('.output textarea');

const numButtons = {};
const constButtons = {};
const opButtons = {};
const funcButtons = {};
const ctrlButtons = {};

numButtons['.'] = document.getElementById('btn-num-.');
ctrlButtons['equals'] = document.getElementById('btn-ctrl-equals');
ctrlButtons['clear'] = document.getElementById('btn-ctrl-clear');
ctrlButtons['del'] = document.getElementById('btn-ctrl-del');
funcButtons['sin'] = document.getElementById('btn-func-sin');
funcButtons['cos'] = document.getElementById('btn-func-cos');
funcButtons['tan'] = document.getElementById('btn-func-tan');
constButtons['π'] = document.getElementById('btn-const-π');
constButtons['Φ'] = document.getElementById('btn-const-Φ');
constButtons['e'] = document.getElementById('btn-const-e');
opButtons['('] = document.getElementById('btn-op-(');
opButtons[')'] = document.getElementById('btn-op-)');


ctrlButtons['equals'].addEventListener('click', (e) => {
    outputTextArea.value = `${expressionParser.evaluate(expressionTextArea.value)}`;
});

for (let i = 0; i < 10; ++i) {
    numButtons[`${i}`] = document.getElementById(`btn-num-${i}`);
}

for (let i = 0; i < expressionParser.operators.length; ++i) {
    const op = expressionParser.operators[i].symbol;
    opButtons[op] = document.getElementById(`btn-op-${op}`);
}

for (const key in numButtons) {
    numButtons[key].addEventListener('click', e => {
        insertStrToExpression(key);
    });
}

for (const key in constButtons) {
    constButtons[key].addEventListener('click', e => {
        insertStrToExpression(key);
    });
}

for (const key in opButtons) {
    opButtons[key].addEventListener('click', e => {
        insertStrToExpression(key);
    });
}

expressionTextArea.addEventListener('beforeinput', e => {
    if (e.data === null) return;

    for (let i = 0; i < e.data.length; ++i) {
        if (!isCharValid(e.data[i])) {
            e.preventDefault();
            return;
        }
    }
});

function insertStrToExpression(str) {
    const sStart = expressionTextArea.selectionStart;
    const sEnd = expressionTextArea.selectionEnd;
    let currText = expressionTextArea.value;

    currText = Array.from(currText);
    currText.splice(sStart, sEnd - sStart, str);
    expressionTextArea.value = currText.join('');

    expressionTextArea.focus();
    expressionTextArea.selectionStart = sStart + str.length;
    expressionTextArea.selectionEnd = expressionTextArea.selectionStart;
}