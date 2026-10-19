# Installation
- make sure python is installed and poetry as well.
- for installation of the crewai framework use the provided guide in the documentation website
- for installation of the imagine-sdk client, first download the wheel file and then use the wheel file
  to build the framework for required base(CrewAI/LangChain), (ps: Make sure you are in the same directory
  as the wheel file when building/installing using pip)

# CrewAI Concepts
Its and agentic AI framework which gives us the freedom to create and utilise agents using AI models
either using the local runtime or cloud based models.

# Additional external resources
Serper AI - for websearch thru the framework and genernal purpose AI compatible websearch provider

## Agents
Agent is an autonomous unit which can,
- perform specific task
- make decisions based on its role and goal
- use tools to accomplush objectives
- communicate and collaborate with other agents
- maintain memory of interactions

Ex: Think of an agent as a specialized team member with specific skills, expertise, and responsibilities.
For example, a Researcher agent might excel at gathering and analyzing information, while a Writer agent
might be better at creating content.

It has several parameters which can be found at [Agent Attributes](https://docs.crewai.com/edge/en/concepts/agents#agent-attributes)

Some of the notable and important ones are, mandatory ones,
| Attribute | Parameter | Type | Desccription | Example |
| --- | --- | --- | --- | --- |
| Role | role | string | defines the agent's function and experitse within the crew | Securty analyst |
| Goal | goal | string | The Individual objective that guides the agent's decision making | Veify the code against MITRE dataset and identify security potential security culnerabilites which are known and has a criticality rating >= 5 or severify medium or high |
| Backstory | backstory | string | Define the *context* and *personality* of the agent | you are a senio security analyst fully capable of detecting and raising concern on known vulnerable application patterns based on credible sources of vulnerabilities such as CVE, MITRE, CrowdStrike, and other security forums and publications |

### Creating an agent
Two ways to create an agent,
- Using the classic JSONC approach
- using python code

*Each agent is included in the crew*

agents are defined under the `agents/` directory, with their filename as the agent name, Example: researcher.jsonc

### Example
```jsonc
// example content for researcher.jsonc
// {placeholder}, put defaults in inputs, and any missing value will be prompted when crewai run is invoked
{
  "role": "{topic} Senior Data Researcher",
  "goal": "Uncover cutting-edge developments in {topic}",
  "backstory": "You find the most relevant information and present it clearly.",
  "llm": "openai/gpt-4o",
  "tools": ["SerperDevTool"],
  "settings": {
    "verbose": true,
    "allow_delegation": false,
    "max_iter": 20
  }
}
```
Then include the agent in crew by adding it to the list as string to the "agents" key, without the `.jsonc` file
extension

Template options available:
- system_template
- prompt_template
- response_template

> [!NOTE] when the agent needs to be examined independently without going thru the full orchestration, use the `kickoff()` method

## Agent Capabilities
the functionalities of an agent can be etended by using the below mentioned 5 methods or such, and each falls under either of the categories namely, Context and Action. The context handles the prompt charecteristics and the action describces the behaviour of the model, its 'way to do things'.
- Tools [Action]
- MCP Server [Action]
- Apps (App integrations) [Action]
- Skills [Context]
- Knowledge [Context]


### Use Cases and Scenario
| When the agent wants to | Use |
| --- | --- |
| search the web | tools |
| call a remote api via MCP | MCP |
| send email via gmail | Apps |
| follow specific procedure | skills |
| reference company docs | Knowledge |

## Tasks
Task is an assigment, which will be accomplished by one or more agents in a defined flow. A task provides all ncessary information for execution such as description, the agent responsible, tools required, etc.

Tasks can be executed in two ways,
- Sequential
- Hierarchical

Attributes to be accompanied by task,
| Attribute | Parameter | Type | Description | Example |
| --- | --- | --- | --- | --- |
| Description | description | string | a clear and concise statement of what the task entails | Research the latest development in AI |
| Expected Output | expected_output | string | a details description of what the task's completion looks like | A list of recent AI Developments |

### Creating a Task
Tasks can be created in two ways,
- JSONC (recommended)
- direct code

Conditional tasks can be configured

Task guardrails can be configured at 2 levels,
- function based, refer [Function Based Guardrails](https://docs.crewai.com/edge/en/concepts/tasks#function-based-guardrails)
- LLm based [LLM based Guardrails](https://docs.crewai.com/edge/en/concepts/tasks#llm-based-guardrails-string-descriptions)

Guardrail function requirement, refer [Requirements and function signature](https://docs.crewai.com/edge/en/concepts/tasks#guardrail-function-requirements)
