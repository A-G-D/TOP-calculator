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
    return Number.isFinite(parseInt(s, 10));
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

    static #operate(op, left, right) {
        switch (op) {
            case OP_ADD:
                if (isNull(left)) left = 0;
                return left + right;
            
            case OP_SUB:
                if (isNull(left)) left = 0;
                return left - right;

            case OP_MUL:
                return left*right;

            case OP_DIV:
                return left/right;

            case OP_POW:
                return left**right;

            case OP_EXP:
                return left*Math.pow(10, right);
        }

        throw new Error('INVALID OPERATION ARGUMENT');
    }

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

                            // console.log('right expr: ', arrToStr(rightExpr));
                            nodes.push(ExpressionParser.#parseNodes(rightExpr, allowAsUnary, ...operators));
                            // console.log('right nodes: ', nodes[nodes.length - 1]);
                            // // segment = '';

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
        // console.log('groups: ', arrToStr(exprNodes));

        for (let i = this.#operators.length - 1; i >= 0; --i) {
            const operator = this.#operators[i];
            exprNodes = ExpressionParser.#parseNodes(
                exprNodes,
                operator.unaryFlag,
                operator.symbol
            );
            // console.log('operator: ', operator.symbol);
            // console.log('nodes: ', (exprNodes));
        }
        // console.log('final nodes: ', arrToStr(exprNodes));

        return new ExpressionTree(exprNodes);
    }

    operate(operator, leftOperand, rightOperand) {
        if (isNumber(operator))
            return parseInt(operator, 10);

        return this.getOperator(operator).procedure(leftOperand, rightOperand);
    }
}


const expressionParser = new ExpressionParser();

expressionParser.addOperator(OP_ADD, (left, right) => left + right, true, 0);
expressionParser.addOperator(OP_SUB, (left, right) => left - right, true, 0);
expressionParser.addOperator(OP_MUL, (left, right) => left*right, false, 1);
expressionParser.addOperator(OP_DIV, (left, right) => left/right, false, 1);
expressionParser.addOperator(OP_POW, (left, right) => Math.pow(left, right), false, 2);
expressionParser.addOperator(OP_MOD, (left, right) => left%right, false, 2);
expressionParser.addOperator(OP_EXP, (left, right) => left*Math.pow(10, right), false, 3);


function evaluateExpression(expression) {
    const expressionTree = expressionParser.parseExpression(expression);
    console.log('tree: ', expressionTree.toString());
    const result = expressionTree.traversePostorder(expressionParser.operate.bind(expressionParser));
    return result
}


console.log('TEST 0:');
let result = evaluateExpression("4^2*3");
console.log(result + '\n\n');

console.log('TEST 1:');
result = evaluateExpression("-2 + (-5*6)  (4^2*3)");
console.log(result + '\n\n');

console.log('TEST 2:');
result = evaluateExpression("-2 + 4*3 + 5");
console.log(result + '\n\n');